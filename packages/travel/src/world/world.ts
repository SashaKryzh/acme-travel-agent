import type {NuiteeHotelDetails, NuiteeHotelSummary, NuiteeReviewsResponse} from "../nuitee/types";

// Imported rather than read from disk, so bundlers such as eve's carry it along.
import worldJson from "../../fixtures/world.json" with {type: "json"};

/** A bookable room type with a fixed nightly price; offers for any dates are derived from it. */
export interface WorldRoom {
    name: string;
    board_type: string;
    board_name: string;
    refundable: boolean;
    nightly: number;
}

export interface WorldHotel {
    id: string;
    city: string;
    summary: NuiteeHotelSummary;
    details: NuiteeHotelDetails;
    reviews: NuiteeReviewsResponse;
    rooms: WorldRoom[];
}

/** A searchable place: hotels within radius_km of its center are in it. */
export interface WorldPlace {
    placeId: string;
    displayName: string;
    formattedAddress: string;
    city: string;
    aliases: string[];
    center: {latitude: number; longitude: number};
    radius_km: number;
}

/** No rates for these hotels on nights from `from` up to `to` (exclusive). */
export interface WorldSoldOut {
    city: string;
    from: string;
    to: string;
}

export interface WorldPage {
    url: string;
    title: string;
    published: string;
    keywords: string[];
    text: string;
}

export interface World {
    currency: string;
    places: WorldPlace[];
    hotels: WorldHotel[];
    sold_out: WorldSoldOut[];
    pages: WorldPage[];
}

/** The demo world: real sandbox hotels recorded once, with fixed prices, plus hand-written web pages. */
export function loadWorld(): World {
    return worldJson as unknown as World;
}
