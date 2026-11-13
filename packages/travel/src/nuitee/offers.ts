import {createHash} from "node:crypto";

import type {HotelOffer} from "../types";
import type {NuiteeCancelPolicyInfo, NuiteeHotelSummary, NuiteeMoneyAmount, NuiteeRatesResponse, NuiteeRoomType} from "./types";

export interface RoomOffer {
    offer_id: string;
    price_amount: number;
    price_currency: string;
    room_name?: string;
    board_name?: string;
    refundable_tag?: string;
    cancellation_deadline?: string;
    max_occupancy?: number;
}

/** The cheapest bookable offer of each hotel, in Nuitee's order. */
export function hotelOffers(rates: NuiteeRatesResponse, checkin: string, checkout: string): HotelOffer[] {
    const summaries = new Map((rates.hotels ?? []).map((hotel) => [hotel.id, hotel]));
    return rates.data.flatMap((hotel) => {
        const room = roomOffers(hotel.roomTypes)[0];
        if (room === undefined) {
            return [];
        }
        return [toHotelOffer(hotel.hotelId, summaries.get(hotel.hotelId), room, checkin, checkout)];
    });
}

export function toHotelOffer(
    hotelId: string,
    summary: NuiteeHotelSummary | undefined,
    room: RoomOffer,
    checkin: string,
    checkout: string
): HotelOffer {
    return compact({
        offer_id: offerAlias(room.offer_id),
        nuitee_offer_id: room.offer_id,
        hotel_id: hotelId,
        name: summary?.name ?? hotelId,
        price_amount: room.price_amount,
        price_currency: room.price_currency,
        checkin,
        checkout,
        photo: summary?.main_photo ?? summary?.thumbnail,
        address: summary?.address,
        city: summary?.city_name,
        country_code: summary?.country_code,
        latitude: summary?.latitude,
        longitude: summary?.longitude,
        rating: summary?.rating,
        review_count: summary?.review_count,
        stars: summary?.stars,
        story: summary?.story,
        tags: summary?.tags,
        room_name: room.room_name,
        board_name: room.board_name,
        refundable_tag: room.refundable_tag
    });
}

export function roomOffers(roomTypes: NuiteeRoomType[] | undefined): RoomOffer[] {
    return (roomTypes ?? []).flatMap((room) => {
        const price = firstAmount(room.offerRetailRate) ?? firstAmount(room.rates?.[0]?.retailRate?.total);
        if (room.offerId === undefined || room.offerId.length === 0 || price === undefined) {
            return [];
        }
        const rate = room.rates?.[0];
        return [
            compact({
                offer_id: room.offerId,
                price_amount: price.amount,
                price_currency: price.currency,
                room_name: rate?.name,
                board_name: rate?.boardName,
                refundable_tag: rate?.cancellationPolicies?.refundableTag,
                cancellation_deadline: cancellationDeadline(rate?.cancellationPolicies?.cancelPolicyInfos),
                max_occupancy: rate?.maxOccupancy
            })
        ];
    });
}

function cancellationDeadline(infos: NuiteeCancelPolicyInfo | NuiteeCancelPolicyInfo[] | null | undefined): string | undefined {
    const list = infos === null || infos === undefined ? [] : Array.isArray(infos) ? infos : [infos];
    const times = list.map((info) => info.cancelTime).filter((time): time is string => time !== undefined);
    return times.sort()[0];
}

function firstAmount(value: NuiteeMoneyAmount | NuiteeMoneyAmount[] | undefined): NuiteeMoneyAmount | undefined {
    return Array.isArray(value) ? value[0] : value;
}

export function compact<T extends object>(value: T): T {
    return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== null)) as T;
}

/** Stable short id for a Nuitee offer id, unique enough within one chat's offers. */
export function offerAlias(nuiteeOfferId: string): string {
    return `of_${createHash("sha256").update(nuiteeOfferId).digest("base64url").slice(0, 10)}`;
}
