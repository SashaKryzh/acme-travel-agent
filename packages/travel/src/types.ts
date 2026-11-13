// Model-facing and display shapes use snake_case, so tool outputs read the same in the model's JSON and in the UI.

export interface Stay {
    checkin: string;
    checkout: string;
    adults: number;
    children: number[];
    currency: string;
    guest_nationality: string;
}

export interface HotelOffer {
    /** Short alias the model and UI use; Nuitee offer ids are around a kilobyte each. */
    offer_id: string;
    nuitee_offer_id: string;
    hotel_id: string;
    name: string;
    price_amount: number;
    price_currency: string;
    checkin: string;
    checkout: string;
    photo?: string;
    address?: string;
    city?: string;
    country_code?: string;
    latitude?: number;
    longitude?: number;
    rating?: number;
    review_count?: number;
    stars?: number;
    room_name?: string;
    board_name?: string;
    refundable_tag?: string;
    story?: string;
    tags?: string[];
}

export interface PricedOffer {
    offer: HotelOffer;
    stay: Stay;
    saved_at: string;
}

export interface HotelCard {
    offer_id: string;
    hotel_id: string;
    name: string;
    price_amount: number;
    price_currency: string;
    nights: number;
    photo?: string;
    address?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
    rating?: number;
    review_count?: number;
    stars?: number;
    room_name?: string;
    board_name?: string;
    refundable: boolean;
}

/** Self-contained, so a card group still renders weeks later without calling Nuitee. */
export interface HotelGroup {
    title: string | null;
    stay: Stay;
    hotels: HotelCard[];
}

/** The booking widget: the stay, its final price and the guest it is booked for, with a Pay button. */
export interface BookingWidget {
    prebook_id: string;
    offer_id: string;
    hotel_id: string;
    hotel_name: string;
    photo?: string;
    address?: string;
    room_name?: string;
    board_name?: string;
    refundable: boolean;
    cancellation_deadline?: string;
    checkin: string;
    checkout: string;
    nights: number;
    adults: number;
    children: number[];
    price: number;
    currency: string;
    price_changed_percent?: number;
    /** Who books, and who stays: the same person unless the user booked for someone else. */
    holder: {name: string; email: string} | null;
    primary_guest: {name: string; email: string} | null;
    /** False when a live supplier key could book for real. */
    test_booking: boolean;
    action_label: string;
}

/** What book and cancel_booking show: the booking's state after the call. */
export interface BookingResult {
    booking_id?: string;
    prebook_id: string;
    status: BookingStatus;
    hotel_id: string;
    hotel_name: string;
    room_name?: string;
    checkin: string;
    checkout: string;
    price: number;
    currency: string;
    hotel_confirmation_code?: string;
    provider_status?: string;
    refund_amount?: number;
    cancellation_fee?: number;
    refund_currency?: string;
}

export type BookingStatus = "prebooked" | "booked" | "cancelled" | "failed";

export interface BookingPerson {
    first_name: string;
    last_name: string;
    email: string;
}

/** The room's terms as the supplier confirmed them at prebook, which the widget keeps when the guest changes. */
export interface PrebookTerms {
    room_name?: string;
    board_name?: string;
    refundable_tag?: string;
    cancellation_deadline?: string;
    price_changed_percent?: number;
}

export interface BookingRecord {
    prebook_id: string;
    offer_id: string;
    /** The eve session the room was picked in. */
    session_id: string;
    status: BookingStatus;
    hotel_id: string;
    hotel_name: string;
    room_name?: string;
    checkin: string;
    checkout: string;
    price: number;
    currency: string;
    booking_id?: string;
    hotel_confirmation_code?: string;
    holder?: BookingPerson;
    primary_guest?: BookingPerson;
    terms?: PrebookTerms;
    created_at: string;
    updated_at: string;
}

/** The ACME account the agent works for. */
export interface Account {
    name: string;
    email: string;
    home_city: string;
    country_code: string;
    currency: string;
    language: string;
    time_zone: string;
}

export interface WebSource {
    url: string;
    title: string | null;
}

/** One finished ACME ride. */
export interface AcmeRide {
    /** Scheduled pickup, or the order time when it was not scheduled; ISO 8601 with offset. */
    started: string;
    pickup: string;
    destination: string | null;
    price: number;
    currency: string;
}

export interface RideHistoryApi {
    finishedRides(fromInclusive: Date, toExclusive: Date, limit: number): Promise<AcmeRide[]>;
}
