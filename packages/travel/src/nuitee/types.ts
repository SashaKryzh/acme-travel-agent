// Shapes of the Nuitee (LiteAPI v3) endpoints we call. Everything optional that Nuitee may omit stays optional.

export interface NuiteeOccupancy {
    adults: number;
    children?: number[];
}

export interface NuiteeRatesRequest {
    checkin: string;
    checkout: string;
    currency: string;
    guestNationality: string;
    occupancies: NuiteeOccupancy[];
    roomMapping?: boolean;
    maxRatesPerHotel?: number;
    includeHotelData?: boolean;
    placeId?: string;
    latitude?: number;
    longitude?: number;
    radius?: number;
    aiSearch?: string;
    hotelIds?: string[];
    minRating?: number;
    starRating?: number[];
    boardType?: string;
    refundableRatesOnly?: boolean;
    hotelName?: string;
    minReviewsCount?: number;
    advancedAccessibilityOnly?: boolean;
    sort?: Array<{field: "top_picks" | "price"; direction: "ascending" | "descending"}>;
    limit?: number;
    timeout?: number;
}

export interface NuiteeMoneyAmount {
    amount: number;
    currency: string;
}

export interface NuiteeCancelPolicyInfo {
    cancelTime?: string;
    timezone?: string;
    amount?: number;
    currency?: string;
    type?: string;
}

export interface NuiteeCancellationPolicies {
    refundableTag?: string;
    cancelPolicyInfos?: NuiteeCancelPolicyInfo | NuiteeCancelPolicyInfo[] | null;
}

export interface NuiteeRate {
    rateId?: string;
    name?: string;
    boardName?: string;
    boardType?: string;
    mappedRoomId?: number | null;
    maxOccupancy?: number;
    retailRate?: {
        total?: NuiteeMoneyAmount | NuiteeMoneyAmount[];
        taxesAndFees?: unknown;
    };
    cancellationPolicies?: NuiteeCancellationPolicies;
}

export interface NuiteeRoomType {
    offerId?: string;
    offerRetailRate?: NuiteeMoneyAmount;
    rates?: NuiteeRate[];
}

export interface NuiteeHotelRate {
    hotelId: string;
    roomTypes?: NuiteeRoomType[];
}

export interface NuiteeHotelSummary {
    id: string;
    name: string;
    main_photo?: string;
    thumbnail?: string;
    address?: string;
    city_name?: string;
    country_code?: string;
    latitude?: number;
    longitude?: number;
    rating?: number;
    review_count?: number;
    stars?: number;
    story?: string;
    tags?: string[];
    persona?: string;
    style?: string;
    location_type?: string;
}

export interface NuiteeRatesResponse {
    data: NuiteeHotelRate[];
    hotels?: NuiteeHotelSummary[];
    sandbox?: boolean;
}

export interface NuiteePlace {
    placeId: string;
    displayName: string;
    formattedAddress: string;
    types?: string[];
    /** The place's center; only the demo world returns it, which lets a search use a radius around it. */
    location?: {latitude: number; longitude: number};
}

export interface NuiteeHotelImage {
    url?: string;
    urlHd?: string;
    caption?: string;
    defaultImage?: boolean;
}

export interface NuiteeStaticRoom {
    id?: number;
    roomName?: string;
    description?: string;
    roomSizeSquare?: number;
    roomSizeUnit?: string;
    maxOccupancy?: number;
    bedTypes?: Array<{quantity?: number; bedType?: string; bedSize?: string}>;
    roomAmenities?: Array<{name?: string}>;
    photos?: Array<{url?: string; hd_url?: string}>;
}

export interface NuiteeSentimentAnalysis {
    pros?: string[];
    cons?: string[];
    categories?: Array<{name?: string; rating?: number; description?: string}>;
}

export interface NuiteeHotelDetails {
    id: string;
    name: string;
    hotelDescription?: string;
    hotelImportantInformation?: string;
    main_photo?: string;
    thumbnail?: string;
    address?: string;
    city?: string;
    country?: string;
    zip?: string;
    location?: {latitude?: number; longitude?: number};
    starRating?: number;
    rating?: number;
    reviewCount?: number;
    hotelFacilities?: string[];
    hotelImages?: NuiteeHotelImage[];
    checkinCheckoutTimes?: {checkin?: string; checkout?: string; checkin_start?: string};
    rooms?: NuiteeStaticRoom[];
    sentiment_analysis?: NuiteeSentimentAnalysis;
    policies?: Array<{name?: string; description?: string}>;
}

export interface NuiteeReview {
    averageScore?: number;
    country?: string;
    type?: string;
    name?: string;
    date?: string;
    headline?: string;
    language?: string;
    pros?: string;
    cons?: string;
    source?: string;
}

export interface NuiteeReviewsResponse {
    data: NuiteeReview[];
    total?: number;
    sentimentAnalysis?: NuiteeSentimentAnalysis;
}

export interface NuiteePrebook {
    prebookId: string;
    offerId?: string;
    hotelId: string;
    price: number;
    currency: string;
    priceDifferencePercent?: number;
    cancellationChanges?: boolean;
    boardChanges?: boolean;
    checkin?: string;
    checkout?: string;
    roomTypes?: NuiteeRoomType[];
}

export interface NuiteeBookingPerson {
    firstName: string;
    lastName: string;
    email: string;
}

export interface NuiteeBookingGuest extends NuiteeBookingPerson {
    occupancyNumber: number;
}

export interface NuiteeBookRequest {
    prebookId: string;
    clientReference: string;
    holder: NuiteeBookingPerson;
    guests: NuiteeBookingGuest[];
    payment: {method: "ACC_CREDIT_CARD"};
}

export interface NuiteeBooking {
    bookingId: string;
    status: string;
    clientReference?: string;
    hotelConfirmationCode?: string;
    checkin?: string;
    checkout?: string;
    hotel?: {hotelId: string; name: string};
    price?: number;
    currency?: string;
    cancellationPolicies?: NuiteeCancellationPolicies;
    holder?: NuiteeBookingPerson;
}

export interface NuiteeCancelBooking {
    bookingId: string;
    status: string;
    currency?: string;
    cancellation_fee?: number;
    refund_amount?: number;
}
