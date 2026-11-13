import {requestJson} from "../http";
import type {
    NuiteeBookRequest,
    NuiteeBooking,
    NuiteeCancelBooking,
    NuiteeHotelDetails,
    NuiteePlace,
    NuiteePrebook,
    NuiteeRatesRequest,
    NuiteeRatesResponse,
    NuiteeReviewsResponse
} from "./types";

const DATA_API = "https://api.liteapi.travel/v3.0";
const BOOKING_API = "https://book.liteapi.travel/v3.0";
const TIMEOUT_MS = 20_000;
/** Booking calls wait on the supplier, so they get longer than search. */
const BOOKING_TIMEOUT_MS = 60_000;

/** What tools need from Nuitee. The demo world implements it with recorded hotels. */
export type NuiteeApi = Pick<
    NuiteeClient,
    "searchPlaces" | "searchRates" | "getHotel" | "getReviews" | "prebook" | "book" | "getBooking" | "listBookingsByClientReference" | "cancelBooking"
>;

export class NuiteeClient {
    public constructor(private readonly apiKey: string) {}

    public async searchPlaces(textQuery: string, signal?: AbortSignal): Promise<NuiteePlace[]> {
        const response = await this.data<{data: NuiteePlace[]}>("/data/places", {query: {textQuery, language: "en"}, signal});
        return response?.data ?? [];
    }

    public async searchRates(request: NuiteeRatesRequest, signal?: AbortSignal): Promise<NuiteeRatesResponse> {
        const response = await this.data<NuiteeRatesResponse>("/hotels/rates", {method: "POST", body: request, signal});
        return response ?? {data: []};
    }

    public async getHotel(hotelId: string, signal?: AbortSignal): Promise<NuiteeHotelDetails | undefined> {
        const response = await this.data<{data: NuiteeHotelDetails}>("/data/hotel", {
            query: {hotelId, timeout: TIMEOUT_MS / 1_000},
            signal
        });
        return response?.data;
    }

    public async getReviews(hotelId: string, limit: number, signal?: AbortSignal): Promise<NuiteeReviewsResponse> {
        const response = await this.data<NuiteeReviewsResponse>("/data/reviews", {
            query: {hotelId, limit, getSentiment: true, timeout: TIMEOUT_MS / 1_000},
            signal
        });
        return response ?? {data: []};
    }

    public async prebook(offerId: string): Promise<NuiteePrebook> {
        const response = await this.booking<{data: NuiteePrebook}>("/rates/prebook", {
            method: "POST",
            body: {offerId, usePaymentSdk: false}
        });
        return required(response, "prebook").data;
    }

    public async book(request: NuiteeBookRequest): Promise<NuiteeBooking> {
        const response = await this.booking<{data: NuiteeBooking}>("/rates/book", {method: "POST", body: request});
        return required(response, "book").data;
    }

    public async getBooking(bookingId: string): Promise<NuiteeBooking | undefined> {
        return (await this.booking<{data: NuiteeBooking}>(`/bookings/${encodeURIComponent(bookingId)}`, {}))?.data;
    }

    public async listBookingsByClientReference(clientReference: string): Promise<NuiteeBooking[]> {
        return (await this.booking<{data: NuiteeBooking[]}>("/bookings", {query: {clientReference}}))?.data ?? [];
    }

    public async cancelBooking(bookingId: string): Promise<NuiteeCancelBooking | undefined> {
        return (
            await this.booking<{data: NuiteeCancelBooking}>(`/bookings/${encodeURIComponent(bookingId)}`, {method: "PUT"})
        )?.data;
    }

    private data<T>(path: string, options: RequestOptions): Promise<T | undefined> {
        return this.request<T>(DATA_API, path, options, TIMEOUT_MS);
    }

    private booking<T>(path: string, options: RequestOptions): Promise<T | undefined> {
        return this.request<T>(BOOKING_API, path, options, BOOKING_TIMEOUT_MS);
    }

    private request<T>(base: string, path: string, options: RequestOptions, timeoutMs: number): Promise<T | undefined> {
        return requestJson<T>({
            service: "Nuitee",
            url: `${base}${path}`,
            method: options.method,
            query: options.query,
            body: options.body,
            headers: {"X-API-Key": this.apiKey},
            timeoutMs,
            signal: options.signal
        });
    }
}

interface RequestOptions {
    method?: "GET" | "POST" | "PUT";
    query?: Record<string, string | number | boolean | undefined>;
    body?: unknown;
    signal?: AbortSignal;
}

function required<T>(value: T | undefined, operation: string): T {
    if (value === undefined) {
        throw new Error(`Nuitee ${operation} returned an empty response`);
    }
    return value;
}
