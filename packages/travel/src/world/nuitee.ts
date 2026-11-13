import {createHash, randomUUID} from "node:crypto";
import path from "node:path";

import {readJson, updateJson} from "../store/jsonFile";
import type {
    NuiteeBookRequest,
    NuiteeBooking,
    NuiteeCancelBooking,
    NuiteeHotelDetails,
    NuiteePlace,
    NuiteePrebook,
    NuiteeRatesRequest,
    NuiteeRatesResponse,
    NuiteeReviewsResponse,
    NuiteeRoomType
} from "../nuitee/types";
import type {NuiteeApi} from "../nuitee/client";

import type {World, WorldHotel, WorldRoom} from "./world";

/** Prebooks and bookings the fake supplier holds, in the demo data folder. */
export interface SupplierState {
    prebooks: Record<string, {offer_id: string; hotel_id: string; price: number; checkin: string; checkout: string}>;
    bookings: Array<NuiteeBooking & {prebook_id: string; refundable: boolean}>;
}

const EMPTY_STATE: SupplierState = {prebooks: {}, bookings: []};
const OFFER_PREFIX = "world";
const FREE_CANCELLATION_DAYS = 2;
const MIN_RADIUS_KM = 1.5;

/** LiteAPI v3 over the demo world: same request and response shapes, fixed prices, real booking state. */
export class WorldNuitee implements NuiteeApi {
    public constructor(
        private readonly world: World,
        private readonly stateDir: string
    ) {}

    /** Places whose name or alias the query mentions, most specific first, within the city it names if any. */
    public async searchPlaces(textQuery: string): Promise<NuiteePlace[]> {
        const query = ` ${normalize(textQuery)} `;
        const matches = this.world.places.filter((place) =>
            [place.displayName, ...place.aliases].some((alias) => query.includes(` ${normalize(alias)} `))
        );
        const cities = new Set(matches.filter((place) => normalize(place.displayName) === normalize(place.city)).map((place) => place.city));
        return matches
            .filter((place) => cities.size === 0 || cities.has(place.city))
            .sort((a, b) => a.radius_km - b.radius_km)
            .slice(0, 4)
            .map((place) => ({
                placeId: place.placeId,
                displayName: place.displayName,
                formattedAddress: place.formattedAddress,
                types: ["locality"],
                location: place.center
            }));
    }

    public async searchRates(request: NuiteeRatesRequest): Promise<NuiteeRatesResponse> {
        const nights = nightCount(request.checkin, request.checkout);
        if (nights < 1) throw new Error("Nuitee 400: checkout must be after checkin");
        const adults = request.occupancies.reduce((sum, occupancy) => sum + occupancy.adults, 0);
        const candidates = this.candidates(request)
            .filter((hotel) => request.minRating === undefined || (hotel.summary.rating ?? 0) >= request.minRating)
            .filter((hotel) => request.starRating === undefined || request.starRating.includes(hotel.summary.stars ?? 0))
            .filter((hotel) => request.minReviewsCount === undefined || (hotel.summary.review_count ?? 0) >= request.minReviewsCount)
            .filter((hotel) => request.hotelName === undefined || normalize(hotel.summary.name).includes(normalize(request.hotelName)))
            .filter((hotel) => request.advancedAccessibilityOnly !== true || accessible(hotel))
            .filter((hotel) => !this.soldOut(hotel, request.checkin, request.checkout));
        const rated = candidates.flatMap((hotel) => {
            const rooms = hotel.rooms
                .map((room, index) => ({room, index}))
                .filter(({room}) => request.refundableRatesOnly !== true || room.refundable)
                .filter(({room}) => request.boardType === undefined || request.boardType.split(",").includes(room.board_type))
                .map(({room, index}) => roomType(hotel, room, index, request.checkin, request.checkout, adults))
                .sort((a, b) => (a.offerRetailRate?.amount ?? 0) - (b.offerRetailRate?.amount ?? 0))
                .slice(0, request.maxRatesPerHotel ?? Number.POSITIVE_INFINITY);
            return rooms.length === 0 || adults > 4 ? [] : [{hotel, rooms}];
        });
        if (request.sort?.[0]?.field === "price") {
            const direction = request.sort[0].direction === "descending" ? -1 : 1;
            rated.sort((a, b) => direction * ((a.rooms[0]?.offerRetailRate?.amount ?? 0) - (b.rooms[0]?.offerRetailRate?.amount ?? 0)));
        }
        const limited = rated.slice(0, request.limit ?? 50);
        return {
            data: limited.map(({hotel, rooms}) => ({hotelId: hotel.id, roomTypes: rooms})),
            ...(request.includeHotelData === true ? {hotels: limited.map(({hotel}) => hotel.summary)} : {}),
            sandbox: true
        };
    }

    public async getHotel(hotelId: string): Promise<NuiteeHotelDetails | undefined> {
        return this.hotel(hotelId)?.details;
    }

    public async getReviews(hotelId: string, limit: number): Promise<NuiteeReviewsResponse> {
        const reviews = this.hotel(hotelId)?.reviews;
        return reviews === undefined ? {data: []} : {...reviews, data: reviews.data.slice(0, limit)};
    }

    public async prebook(offerId: string): Promise<NuiteePrebook> {
        const offer = this.parseOffer(offerId);
        if (this.soldOut(offer.hotel, offer.checkin, offer.checkout)) throw new Error("Nuitee 409: no availability for this rate");
        const type = roomType(offer.hotel, offer.room, offer.index, offer.checkin, offer.checkout, offer.adults);
        const price = type.offerRetailRate?.amount ?? 0;
        const prebookId = `pb_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
        await this.update((state) => ({
            ...state,
            prebooks: {...state.prebooks, [prebookId]: {offer_id: offerId, hotel_id: offer.hotel.id, price, checkin: offer.checkin, checkout: offer.checkout}}
        }));
        return {
            prebookId,
            offerId,
            hotelId: offer.hotel.id,
            price,
            currency: this.world.currency,
            priceDifferencePercent: 0,
            cancellationChanges: false,
            boardChanges: false,
            checkin: offer.checkin,
            checkout: offer.checkout,
            roomTypes: [type]
        };
    }

    public async book(request: NuiteeBookRequest): Promise<NuiteeBooking> {
        let booked: NuiteeBooking | undefined;
        await this.update((state) => {
            const existing = state.bookings.find((booking) => booking.clientReference === request.clientReference);
            if (existing !== undefined) {
                booked = existing;
                return state;
            }
            const prebook = state.prebooks[request.prebookId];
            if (prebook === undefined) throw new Error("Nuitee 404: prebook not found or expired");
            const offer = this.parseOffer(prebook.offer_id);
            const booking = {
                bookingId: `bk_${randomUUID().replaceAll("-", "").slice(0, 10)}`,
                status: "CONFIRMED",
                clientReference: request.clientReference,
                hotelConfirmationCode: `W${createHash("sha256").update(request.prebookId).digest("hex").slice(0, 6).toUpperCase()}`,
                checkin: prebook.checkin,
                checkout: prebook.checkout,
                hotel: {hotelId: offer.hotel.id, name: offer.hotel.summary.name},
                price: prebook.price,
                currency: this.world.currency,
                cancellationPolicies: roomType(offer.hotel, offer.room, offer.index, offer.checkin, offer.checkout, offer.adults).rates?.[0]
                    ?.cancellationPolicies,
                holder: request.holder,
                prebook_id: request.prebookId,
                refundable: offer.room.refundable
            };
            booked = booking;
            return {...state, bookings: [...state.bookings, booking]};
        });
        return publicBooking(booked as SupplierState["bookings"][number]);
    }

    public async getBooking(bookingId: string): Promise<NuiteeBooking | undefined> {
        const booking = (await this.state()).bookings.find((item) => item.bookingId === bookingId);
        return booking === undefined ? undefined : publicBooking(booking);
    }

    public async listBookingsByClientReference(clientReference: string): Promise<NuiteeBooking[]> {
        return (await this.state()).bookings.filter((item) => item.clientReference === clientReference).map(publicBooking);
    }

    public async cancelBooking(bookingId: string): Promise<NuiteeCancelBooking | undefined> {
        let result: NuiteeCancelBooking | undefined;
        await this.update((state) => {
            const booking = state.bookings.find((item) => item.bookingId === bookingId);
            if (booking === undefined || booking.status !== "CONFIRMED") return state;
            const free = booking.refundable;
            const price = booking.price ?? 0;
            result = {
                bookingId,
                status: free ? "CANCELLED" : "CANCELLED_WITH_CHARGES",
                currency: this.world.currency,
                cancellation_fee: free ? 0 : price,
                refund_amount: free ? price : 0
            };
            return {
                ...state,
                bookings: state.bookings.map((item) => (item.bookingId === bookingId ? {...item, status: result?.status ?? item.status} : item))
            };
        });
        return result;
    }

    public state(): Promise<SupplierState> {
        return readJson<SupplierState>(this.stateFile(), EMPTY_STATE);
    }

    private update(change: (state: SupplierState) => SupplierState): Promise<SupplierState> {
        return updateJson<SupplierState>(this.stateFile(), EMPTY_STATE, change);
    }

    private stateFile(): string {
        return path.join(this.stateDir, "supplier.json");
    }

    private candidates(request: NuiteeRatesRequest): WorldHotel[] {
        if (request.hotelIds !== undefined) {
            return request.hotelIds.flatMap((id) => this.hotel(id) ?? []);
        }
        if (request.latitude !== undefined && request.longitude !== undefined) {
            const center = {latitude: request.latitude, longitude: request.longitude};
            // The world holds a fraction of a city's hotels, so a neighbourhood search looks at least 1.5 km around it.
            const radiusKm = Math.max((request.radius ?? 10_000) / 1000, MIN_RADIUS_KM);
            return this.world.hotels
                .filter((hotel) => distanceKm(center, hotel.summary) <= radiusKm)
                .sort((a, b) => (b.summary.rating ?? 0) - (a.summary.rating ?? 0));
        }
        if (request.placeId !== undefined) {
            const place = this.world.places.find((item) => item.placeId === request.placeId);
            if (place === undefined) return [];
            return this.world.hotels
                .filter((hotel) => hotel.city === place.city && distanceKm(place.center, hotel.summary) <= place.radius_km)
                .sort((a, b) => (b.summary.rating ?? 0) - (a.summary.rating ?? 0));
        }
        if (request.aiSearch !== undefined) {
            const query = normalize(request.aiSearch);
            const cities = new Set(
                this.world.places.filter((place) => [place.city, ...place.aliases].some((alias) => query.includes(normalize(alias)))).map((place) => place.city)
            );
            const words = query.split(" ").filter((word) => word.length > 3);
            return this.world.hotels
                .filter((hotel) => cities.size === 0 || cities.has(hotel.city))
                .map((hotel) => {
                    const haystack = normalize([hotel.summary.name, ...(hotel.summary.tags ?? []), hotel.summary.story ?? ""].join(" "));
                    const tagHits = (hotel.summary.tags ?? []).filter((tag) => query.includes(normalize(tag))).length;
                    return {hotel, score: tagHits * 3 + words.filter((word) => haystack.includes(word)).length};
                })
                .sort((a, b) => b.score - a.score || (b.hotel.summary.rating ?? 0) - (a.hotel.summary.rating ?? 0))
                .map(({hotel}) => hotel);
        }
        return [];
    }

    private hotel(hotelId: string): WorldHotel | undefined {
        return this.world.hotels.find((hotel) => hotel.id === hotelId);
    }

    private soldOut(hotel: WorldHotel, checkin: string, checkout: string): boolean {
        return this.world.sold_out.some((window) => window.city === hotel.city && checkin < window.to && checkout > window.from);
    }

    private parseOffer(offerId: string) {
        const [prefix, hotelId, index, checkin, checkout, adults] = offerId.split("|");
        const hotel = hotelId === undefined ? undefined : this.hotel(hotelId);
        const room = hotel?.rooms[Number(index)];
        if (prefix !== OFFER_PREFIX || hotel === undefined || room === undefined || checkin === undefined || checkout === undefined) {
            throw new Error("Nuitee 404: offer not found or expired");
        }
        return {hotel, room, index: Number(index), checkin, checkout, adults: Number(adults ?? 2)};
    }
}

function roomType(hotel: WorldHotel, room: WorldRoom, index: number, checkin: string, checkout: string, adults: number): NuiteeRoomType {
    const nights = nightCount(checkin, checkout);
    // A third or fourth adult pays a quarter more per night.
    const amount = Math.round(room.nightly * nights * (adults > 2 ? 1.25 : 1) * 100) / 100;
    const total = {amount, currency: "EUR"};
    const deadline = new Date(Date.parse(`${checkin}T23:59:00Z`) - FREE_CANCELLATION_DAYS * 86_400_000).toISOString().replace(".000Z", "");
    return {
        offerId: [OFFER_PREFIX, hotel.id, index, checkin, checkout, adults].join("|"),
        offerRetailRate: total,
        rates: [
            {
                rateId: `${hotel.id}-${index}`,
                name: room.name,
                boardName: room.board_name,
                boardType: room.board_type,
                maxOccupancy: Math.max(2, adults),
                retailRate: {total: [total]},
                cancellationPolicies: room.refundable
                    ? {refundableTag: "RFN", cancelPolicyInfos: [{cancelTime: deadline, amount, currency: "EUR", type: "amount", timezone: "GMT"}]}
                    : {refundableTag: "NRFN", cancelPolicyInfos: []}
            }
        ]
    };
}

function accessible(hotel: WorldHotel): boolean {
    return (hotel.details.hotelFacilities ?? []).some((facility) => /accessib|wheelchair|disabled/i.test(facility));
}

function publicBooking({prebook_id: _prebookId, refundable: _refundable, ...booking}: SupplierState["bookings"][number]): NuiteeBooking {
    return booking;
}

function nightCount(checkin: string, checkout: string): number {
    return Math.round((Date.parse(checkout) - Date.parse(checkin)) / 86_400_000);
}

function normalize(text: string): string {
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9 ]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function distanceKm(a: {latitude: number; longitude: number}, b: {latitude?: number; longitude?: number}): number {
    if (b.latitude === undefined || b.longitude === undefined) return Number.POSITIVE_INFINITY;
    const rad = Math.PI / 180;
    const dLat = (b.latitude - a.latitude) * rad;
    const dLng = (b.longitude - a.longitude) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLng / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.sqrt(h));
}
