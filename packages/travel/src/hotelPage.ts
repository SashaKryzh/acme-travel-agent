import type {ToolContext} from "./context";
import {compact, offerAlias, roomOffers, toHotelOffer, type RoomOffer} from "./nuitee/offers";
import type {NuiteeHotelDetails} from "./nuitee/types";
import {isRefundable} from "./stay";
import type {PricedOffer, Stay} from "./types";

const PAGE_RATES_PER_HOTEL = 20;
const PAGE_IMAGES_MAX = 16;

export interface HotelPage {
    stay: Stay;
    hotel: {
        hotel_id: string;
        name: string;
        stars?: number;
        rating?: number;
        review_count?: number;
        address?: string;
        latitude?: number;
        longitude?: number;
        description?: string;
        checkin_time?: string;
        checkout_time?: string;
        facilities: string[];
        images: string[];
    };
    rooms: Array<RoomOffer & {refundable: boolean; photo?: string}>;
}

/** Thrown when the card's offer is unknown to the session, so the page can say so instead of failing. */
export class OfferNotFoundError extends Error {}

/** The hotel page the UI opens from a card: full details and every room for the card's stay. Not a model tool. */
export async function loadHotelPage(ctx: ToolContext, offerId: string): Promise<HotelPage> {
    const priced = (await ctx.store.getOffers(ctx.sessionId))[offerId];
    if (priced === undefined) throw new OfferNotFoundError("This offer has expired; ask the agent to search again");
    const {stay, offer} = priced;
    const [hotel, rates] = await Promise.all([
        ctx.nuitee().getHotel(offer.hotel_id, ctx.abortSignal),
        ctx.nuitee().searchRates(
            {
                checkin: stay.checkin,
                checkout: stay.checkout,
                currency: stay.currency,
                guestNationality: stay.guest_nationality,
                occupancies: [{adults: stay.adults, ...(stay.children.length > 0 ? {children: stay.children} : {})}],
                roomMapping: true,
                timeout: 15,
                hotelIds: [offer.hotel_id],
                maxRatesPerHotel: PAGE_RATES_PER_HOTEL,
                includeHotelData: true
            },
            ctx.abortSignal
        )
    ]);
    if (hotel === undefined) throw new OfferNotFoundError("Hotel not found");
    const rooms = roomOffers(rates.data[0]?.roomTypes);
    const summary = rates.hotels?.[0] ?? summaryFromDetails(hotel);
    const savedAt = new Date().toISOString();
    // The page's rooms become offers of this session, so Select can prebook them by the id the model sees.
    await ctx.store.saveOffers(
        ctx.sessionId,
        rooms.map((room): PricedOffer => ({offer: toHotelOffer(hotel.id, summary, room, stay.checkin, stay.checkout), stay, saved_at: savedAt}))
    );
    const roomPhotos = new Map((hotel.rooms ?? []).map((room) => [room.roomName?.toLowerCase() ?? "", room.photos?.[0]?.hd_url ?? room.photos?.[0]?.url]));
    return {
        stay,
        hotel: compact({
            hotel_id: hotel.id,
            name: hotel.name,
            stars: hotel.starRating,
            rating: hotel.rating ?? offer.rating,
            review_count: hotel.reviewCount ?? offer.review_count,
            address: [hotel.address, hotel.city].filter(Boolean).join(", "),
            latitude: hotel.location?.latitude,
            longitude: hotel.location?.longitude,
            description: hotel.hotelDescription === undefined ? undefined : stripHtml(hotel.hotelDescription),
            checkin_time: hotel.checkinCheckoutTimes?.checkin_start ?? hotel.checkinCheckoutTimes?.checkin,
            checkout_time: hotel.checkinCheckoutTimes?.checkout,
            facilities: hotel.hotelFacilities ?? [],
            images: [
                ...new Set(
                    [hotel.main_photo, ...(hotel.hotelImages ?? []).map((image) => image.urlHd ?? image.url)].filter(
                        (url): url is string => url !== undefined && url.length > 0
                    )
                )
            ].slice(0, PAGE_IMAGES_MAX),
        }),
        rooms: rooms.map((room) =>
            compact({
                ...room,
                offer_id: offerAlias(room.offer_id),
                refundable: isRefundable(room.refundable_tag),
                photo: roomPhotos.get(room.room_name?.toLowerCase() ?? "")
            })
        )
    };
}

function summaryFromDetails(hotel: NuiteeHotelDetails) {
    return compact({
        id: hotel.id,
        name: hotel.name,
        main_photo: hotel.main_photo,
        address: hotel.address,
        city_name: hotel.city,
        latitude: hotel.location?.latitude,
        longitude: hotel.location?.longitude,
        rating: hotel.rating,
        review_count: hotel.reviewCount,
        stars: hotel.starRating
    });
}

function stripHtml(value: string): string {
    return value
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/\s+/g, " ")
        .trim();
}
