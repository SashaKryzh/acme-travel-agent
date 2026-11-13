// Parts the travel tools share: parameter schemas, the stay rules, offer lookup, and the JSON the model reads.
// What the UI renders (hotel cards, the booking widget) is the tool's output; what the model reads is
// `model_output`, which toModelOutput sends instead.
import {defineTool} from "eve/tools";

import {
    compact,
    isRefundable,
    nights,
    resolveStay,
    stayKey,
    toHotelOffer,
    toolContext,
    type BookingPerson,
    type BookingRecord,
    type BookingResult,
    type BookingWidget,
    type HotelCard,
    type HotelOffer,
    type NuiteeBooking,
    type NuiteeCancellationPolicies,
    type NuiteeCancelPolicyInfo,
    type NuiteeHotelSummary,
    type NuiteePrebook,
    type PrebookTerms,
    type PricedOffer,
    type RoomOffer,
    type Stay,
    type ToolContext
} from "@acme/travel";

export const HOTEL_SEARCH_LIMIT_MAX = 100;
export const MAX_HOTELS_PER_GROUP = 6;
/** The label of the booking widget's button. */
export const PAY = "Pay";

type JsonSchema = Record<string, unknown>;

/** What a tool returns: the data the UI renders, plus the text the model reads. */
export type ToolOutput<T extends object = Record<string, unknown>> = T & {model_output: string};

interface EveCall {
    session: {id: string};
    abortSignal?: AbortSignal;
}

/**
 * A travel tool as an eve tool: a description and a plain JSON schema, and a run that returns UI data plus the
 * model's JSON. A thrown Error is the failure text the model reads.
 */
export function travelTool<T extends object>(definition: {
    description: string;
    parameters: JsonSchema;
    run: (args: Record<string, unknown>, ctx: ToolContext) => Promise<ToolOutput<T>>;
}) {
    return defineTool({
        description: definition.description,
        // A plain JSON Schema reaches the model as written; eve validates input against it.
        inputSchema: definition.parameters as never,
        async execute(input, ctx) {
            const call = ctx as unknown as EveCall;
            return (await definition.run(input as Record<string, unknown>, toolContext(call.session.id, call.abortSignal))) as never;
        },
        toModelOutput: (output) => ({type: "text", value: (output as unknown as ToolOutput).model_output})
    });
}

export function fail(message: string): never {
    throw new Error(message);
}

/** The model's JSON is written as given; pass it through omitEmpty to drop the facts Nuitee left blank. */
export function output<T extends object>(ui: T, model: unknown): ToolOutput<T> {
    return {...ui, model_output: typeof model === "string" ? model : JSON.stringify(model)};
}

// Parameters

export const STAY_PARAMETER_PROPERTIES = {
    checkin: {type: "string", description: "Check-in date in YYYY-MM-DD"},
    checkout: {type: "string", description: "Check-out date in YYYY-MM-DD"},
    adults: {type: "integer", description: "Adults in the room"},
    children: {
        type: ["array", "null"],
        items: {type: "integer"},
        description: "Ages of children staying in the room, or null when there are no children"
    },
    currency: {
        type: ["string", "null"],
        description: "ISO 4217 code of a currency the user asked for, or null to use their home currency"
    },
    guest_nationality: {
        type: ["string", "null"],
        description: "ISO 3166-1 alpha-2 code of a nationality the user stated, or null to use their home country"
    },
    limit: {type: "integer", description: `How many hotels to return. From 1 to ${HOTEL_SEARCH_LIMIT_MAX}`}
} as const;

export const BOARD_TYPES = [
    "room_only",
    "breakfast",
    "half_board",
    "full_board",
    "all_inclusive",
    "dinner",
    "lunch",
    "breakfast_and_dinner",
    "breakfast_and_lunch",
    "lunch_and_dinner"
] as const;

const NUITEE_BOARD_CODES: Record<(typeof BOARD_TYPES)[number], string> = {
    room_only: "RO",
    breakfast: "BI",
    half_board: "HB",
    full_board: "FB",
    all_inclusive: "AI",
    dinner: "DI",
    lunch: "LI",
    breakfast_and_dinner: "BDI",
    breakfast_and_lunch: "BLI",
    lunch_and_dinner: "LDI"
};

export const FILTER_PARAMETER_PROPERTIES = {
    star_rating: {
        type: ["array", "null"],
        items: {type: "number"},
        description: "Star ratings to include, in half stars, for example [4, 4.5, 5], or null for any"
    },
    min_reviews_count: {
        type: ["integer", "null"],
        minimum: 0,
        description: "Least number of guest reviews a hotel must have, or null for any"
    },
    board_types: {
        type: ["array", "null"],
        items: {type: "string", enum: [...BOARD_TYPES]},
        description: "Meal plans to include, or null for any"
    },
    refundable_only: {type: ["boolean", "null"], description: "True to return only refundable rates, or null for any"},
    accessible_only: {
        type: ["boolean", "null"],
        description: "True to return only hotels with advanced accessibility features, or null for any"
    },
    sort: {
        type: ["string", "null"],
        enum: ["top_picks", "price_low_to_high", "price_high_to_low", null],
        description: "Order of results, or null for top picks"
    }
} as const;

export const FILTER_PARAMETER_NAMES = ["star_rating", "min_reviews_count", "board_types", "refundable_only", "accessible_only", "sort"];

export function personSchema(description: string): JsonSchema {
    return {
        type: "object",
        description,
        properties: {first_name: {type: "string"}, last_name: {type: "string"}, email: {type: "string", format: "email"}},
        required: ["first_name", "last_name", "email"],
        additionalProperties: false
    };
}

// Stays and searches

/** Check-in today or later, check-out after it, currency and nationality from the account. */
export function stayFrom(args: Record<string, unknown>, ctx: ToolContext): Stay {
    try {
        return resolveStay(
            {
                checkin: String(args.checkin),
                checkout: String(args.checkout),
                adults: Number(args.adults),
                children: (args.children as number[] | null | undefined) ?? null,
                currency: (args.currency as string | null | undefined) ?? null,
                guest_nationality: (args.guest_nationality as string | null | undefined) ?? null
            },
            ctx.account,
            ctx.now
        );
    } catch (error: unknown) {
        return fail(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export function stayRatesRequest(stay: Stay, limit: number, maxRatesPerHotel: number) {
    return {
        checkin: stay.checkin,
        checkout: stay.checkout,
        currency: stay.currency,
        guestNationality: stay.guest_nationality,
        occupancies: [{adults: stay.adults, ...(stay.children.length > 0 ? {children: stay.children} : {})}],
        roomMapping: true,
        maxRatesPerHotel,
        includeHotelData: true,
        limit,
        timeout: 15
    };
}

export function filterRatesRequest(args: Record<string, unknown>) {
    const stars = args.star_rating as number[] | null;
    const boards = args.board_types as Array<(typeof BOARD_TYPES)[number]> | null;
    const sort = args.sort as string | null;
    return {
        ...(stars !== null && stars.length > 0 ? {starRating: stars} : {}),
        ...(args.min_reviews_count === null ? {} : {minReviewsCount: Number(args.min_reviews_count)}),
        ...(boards !== null && boards.length > 0 ? {boardType: boards.map((board) => NUITEE_BOARD_CODES[board]).join(",")} : {}),
        ...(args.refundable_only === true ? {refundableRatesOnly: true} : {}),
        ...(args.accessible_only === true ? {advancedAccessibilityOnly: true} : {}),
        ...(sort === "price_low_to_high"
            ? {sort: [{field: "price" as const, direction: "ascending" as const}]}
            : sort === "price_high_to_low"
              ? {sort: [{field: "price" as const, direction: "descending" as const}]}
              : {})
    };
}

/** Offers are kept per session, so show_hotels, prebook and the hotel page can find them by the id the model saw. */
export async function rememberOffers(ctx: ToolContext, stay: Stay, offers: HotelOffer[]): Promise<void> {
    const savedAt = new Date().toISOString();
    await ctx.store.saveOffers(
        ctx.sessionId,
        offers.map((offer): PricedOffer => ({offer, stay, saved_at: savedAt}))
    );
}

export function roomOffer(hotelId: string, summary: NuiteeHotelSummary | undefined, room: RoomOffer, stay: Stay): HotelOffer {
    return toHotelOffer(hotelId, summary, room, stay.checkin, stay.checkout);
}

export function sameStay(a: Stay, b: Stay): boolean {
    return stayKey(a) === stayKey(b);
}

export function hotelCard(offer: HotelOffer): HotelCard {
    return compact({
        offer_id: offer.offer_id,
        hotel_id: offer.hotel_id,
        name: offer.name,
        price_amount: offer.price_amount,
        price_currency: offer.price_currency,
        nights: nights(offer.checkin, offer.checkout),
        photo: offer.photo,
        address: offer.address,
        city: offer.city,
        latitude: offer.latitude,
        longitude: offer.longitude,
        rating: offer.rating,
        review_count: offer.review_count,
        stars: offer.stars,
        room_name: offer.room_name,
        board_name: offer.board_name,
        refundable: isRefundable(offer.refundable_tag)
    });
}

// Booking

/** The account holder as a guest, which prefills the booking widget. */
export function accountGuest(ctx: ToolContext): BookingPerson | undefined {
    const [first, ...rest] = ctx.account.name.trim().split(/\s+/);
    if (first === undefined || first.length === 0 || rest.length === 0 || ctx.account.email.length === 0) return undefined;
    return {first_name: first, last_name: rest.join(" "), email: ctx.account.email};
}

/** The room's terms from the prebook response, kept on the booking record. */
export function prebookTerms(prebook: NuiteePrebook): PrebookTerms {
    const rate = prebook.roomTypes?.[0]?.rates?.[0];
    return compact({
        room_name: rate?.name,
        board_name: rate?.boardName,
        refundable_tag: rate?.cancellationPolicies?.refundableTag,
        cancellation_deadline: firstCancelTime(rate?.cancellationPolicies?.cancelPolicyInfos),
        price_changed_percent: prebook.priceDifferencePercent === 0 ? undefined : prebook.priceDifferencePercent
    });
}

/** The booking widget: the stay, its final price and terms, and its guest, with a Pay button. */
export async function bookingWidget(ctx: ToolContext, record: BookingRecord): Promise<BookingWidget> {
    const priced = (await ctx.store.getOffers(ctx.sessionId))[record.offer_id];
    const terms = record.terms ?? {};
    const holder = record.holder ?? accountGuest(ctx);
    const guest = record.primary_guest ?? holder;
    return compact({
        prebook_id: record.prebook_id,
        offer_id: record.offer_id,
        hotel_id: record.hotel_id,
        hotel_name: record.hotel_name,
        photo: priced?.offer.photo,
        address: priced?.offer.address,
        room_name: terms.room_name ?? record.room_name,
        board_name: terms.board_name ?? priced?.offer.board_name,
        refundable: isRefundable(terms.refundable_tag ?? priced?.offer.refundable_tag),
        cancellation_deadline: terms.cancellation_deadline,
        checkin: record.checkin,
        checkout: record.checkout,
        nights: nights(record.checkin, record.checkout),
        adults: priced?.stay.adults ?? 1,
        children: priced?.stay.children ?? [],
        price: record.price,
        currency: record.currency,
        price_changed_percent: terms.price_changed_percent,
        holder: person(holder),
        primary_guest: person(guest),
        action_label: PAY
    }) as BookingWidget;
}

function person(value: BookingPerson | undefined): {name: string; email: string} | null {
    return value === undefined ? null : {name: `${value.first_name} ${value.last_name}`, email: value.email};
}

export function bookingResult(record: BookingRecord, extra: Partial<BookingResult> = {}): BookingResult {
    return compact<BookingResult>({
        booking_id: record.booking_id,
        prebook_id: record.prebook_id,
        status: record.status,
        hotel_id: record.hotel_id,
        hotel_name: record.hotel_name,
        room_name: record.room_name,
        checkin: record.checkin,
        checkout: record.checkout,
        price: record.price,
        currency: record.currency,
        hotel_confirmation_code: record.hotel_confirmation_code,
        ...extra
    });
}

function firstCancelTime(infos: NuiteeCancelPolicyInfo | NuiteeCancelPolicyInfo[] | null | undefined): string | undefined {
    const list = infos === null || infos === undefined ? [] : Array.isArray(infos) ? infos : [infos];
    return list
        .map((info) => info.cancelTime)
        .filter((time): time is string => time !== undefined)
        .sort()[0];
}

// What the model reads

export function mapHotelOffer(offer: HotelOffer) {
    return {
        hotel_id: offer.hotel_id,
        name: offer.name === offer.hotel_id ? undefined : offer.name,
        ...mapRoomOffer(offer),
        address: offer.address,
        city: offer.city,
        rating: positive(offer.rating),
        review_count: offer.review_count,
        stars: positive(offer.stars),
        story: offer.story
    };
}

export function mapRoomOffer(offer: {offer_id: string; price_amount: number; price_currency: string; room_name?: string; board_name?: string; refundable_tag?: string}) {
    return {
        offer_id: offer.offer_id,
        price_amount: offer.price_amount,
        price_currency: offer.price_currency,
        ...mapRoomTerms(offer)
    };
}

export function mapRoomTerms(offer: {room_name?: string; board_name?: string; refundable_tag?: string}) {
    return {room_name: offer.room_name, meal_plan: offer.board_name, cancellation: mapCancellation(offer.refundable_tag)};
}

export function mapPrebook(data: NuiteePrebook) {
    return {
        prebook_id: data.prebookId,
        hotel_id: data.hotelId,
        price_amount: data.price,
        price_currency: data.currency,
        rooms: (data.roomTypes ?? []).flatMap((room) =>
            (room.rates ?? []).map((rate) => ({
                room_name: rate.name,
                meal_plan: rate.boardName,
                ...mapCancellationPolicy(rate.cancellationPolicies)
            }))
        ),
        price_difference_percent: data.priceDifferencePercent,
        cancellation_changed: data.cancellationChanges,
        board_changed: data.boardChanges
    };
}

export function mapBooking(data: NuiteeBooking) {
    return {
        booking_id: data.bookingId,
        status: data.status,
        checkin: data.checkin,
        checkout: data.checkout,
        hotel_id: data.hotel?.hotelId,
        hotel_name: data.hotel?.name,
        price_amount: data.price,
        price_currency: data.currency,
        hotel_confirmation_code: data.hotelConfirmationCode,
        ...mapCancellationPolicy(data.cancellationPolicies)
    };
}

export function mapCancellationPolicy(policy: NuiteeCancellationPolicies | undefined) {
    const fees = policy?.cancelPolicyInfos ?? [];
    const entries = Array.isArray(fees) ? fees : [fees];
    return {
        cancellation: mapCancellation(policy?.refundableTag),
        cancellation_fees:
            entries.length === 0
                ? undefined
                : entries.map((fee) => ({from: fee.cancelTime, timezone: fee.timezone, amount: fee.amount, currency: fee.currency, type: fee.type}))
    };
}

export function mapCancellation(tag: string | undefined): string | undefined {
    switch (tag) {
        case undefined:
            return undefined;
        case "RFN":
            return "refundable";
        case "NRFN":
            return "non_refundable";
        default:
            return tag;
    }
}

function positive(value: number | undefined): number | undefined {
    return value !== undefined && value > 0 ? value : undefined;
}

/** Drops nulls, blank strings and empty arrays and objects, which Nuitee sends for most facts it does not know. */
export function omitEmpty(value: unknown): unknown {
    if (value === null || value === undefined || (typeof value === "string" && value.trim().length === 0)) return undefined;
    if (Array.isArray(value)) {
        const items = value.map(omitEmpty).filter((item) => item !== undefined);
        return items.length > 0 ? items : undefined;
    }
    if (typeof value === "object") {
        const entries = Object.entries(value).flatMap(([key, item]) => {
            const kept = omitEmpty(item);
            return kept === undefined ? [] : [[key, kept] as const];
        });
        return entries.length > 0 ? Object.fromEntries(entries) : undefined;
    }
    return value;
}

export function stripHtml(text: string | undefined): string | undefined {
    return text?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
