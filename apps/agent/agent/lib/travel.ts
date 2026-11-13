// What the travel tools share: input schemas, the stay rules, offer lookup, the booking widget, and the compact
// JSON the model reads. A tool returns what the UI renders; its toModelOutput picks what the model needs.
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
import {z} from "zod";

export const MAX_HOTELS_PER_GROUP = 6;

/** The travel context of an eve tool call: its session's offers, the store, the account and the clients. */
export function travel(ctx: {session: {id: string}; abortSignal?: AbortSignal}): ToolContext {
    return toolContext(ctx.session.id, ctx.abortSignal);
}

/** Model-facing JSON, without the facts Nuitee left blank. */
export function json(value: unknown) {
    return {type: "json" as const, value: omitEmpty(value) ?? {}};
}

// Input schemas

const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const stayFields = {
    checkin: DATE.describe("Check-in date in YYYY-MM-DD"),
    checkout: DATE.describe("Check-out date in YYYY-MM-DD"),
    adults: z.number().int().min(1).describe("Adults in the room"),
    children: z.array(z.number().int().min(0)).nullable().describe("Ages of children staying in the room, or null when there are no children"),
    currency: z.string().nullable().describe("ISO 4217 code of a currency the user asked for, or null to use their home currency"),
    guest_nationality: z.string().nullable().describe("ISO 3166-1 alpha-2 code of a nationality the user stated, or null to use their home country")
};

export const searchFields = {
    ...stayFields,
    limit: z.number().int().min(1).max(100).describe("How many hotels to return, from 1 to 100"),
    star_rating: z.array(z.number()).nullable().describe("Star ratings to include, in half stars, for example [4, 4.5, 5], or null for any"),
    min_reviews_count: z.number().int().min(0).nullable().describe("Least number of guest reviews a hotel must have, or null for any"),
    board_types: z
        .array(z.enum(["room_only", "breakfast", "half_board", "full_board", "all_inclusive", "dinner", "lunch", "breakfast_and_dinner", "breakfast_and_lunch", "lunch_and_dinner"]))
        .nullable()
        .describe("Meal plans to include, or null for any"),
    refundable_only: z.boolean().nullable().describe("True to return only refundable rates, or null for any"),
    accessible_only: z.boolean().nullable().describe("True to return only hotels with advanced accessibility features, or null for any"),
    sort: z.enum(["top_picks", "price_low_to_high", "price_high_to_low"]).nullable().describe("Order of results, or null for top picks")
};

export const person = (description: string) =>
    z.object({first_name: z.string(), last_name: z.string(), email: z.string()}).describe(description);

type StayInput = z.infer<z.ZodObject<typeof stayFields>>;
type SearchInput = z.infer<z.ZodObject<typeof searchFields>>;

const BOARD_CODES: Record<NonNullable<SearchInput["board_types"]>[number], string> = {
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

// Stays and searches

/** Check-in today or later, check-out after it, currency and nationality from the account. */
export function stayFrom(input: StayInput, ctx: ToolContext): Stay {
    return resolveStay(input, ctx.account, ctx.now);
}

export function ratesRequest(stay: Stay, limit: number, maxRatesPerHotel: number) {
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

export function filters(input: SearchInput) {
    return {
        ...(input.star_rating !== null && input.star_rating.length > 0 ? {starRating: input.star_rating} : {}),
        ...(input.min_reviews_count === null ? {} : {minReviewsCount: input.min_reviews_count}),
        ...(input.board_types !== null && input.board_types.length > 0 ? {boardType: input.board_types.map((board) => BOARD_CODES[board]).join(",")} : {}),
        ...(input.refundable_only === true ? {refundableRatesOnly: true} : {}),
        ...(input.accessible_only === true ? {advancedAccessibilityOnly: true} : {}),
        ...(input.sort === "price_low_to_high"
            ? {sort: [{field: "price" as const, direction: "ascending" as const}]}
            : input.sort === "price_high_to_low"
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

/** The booking widget: the stay, its final price and terms, and its guest. */
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
        holder: personText(holder),
        primary_guest: personText(guest)
    }) as BookingWidget;
}

/** What the model reads about a widget: everything but the display-only photo and address. */
export function widgetForModel({photo: _photo, address: _address, offer_id: _offerId, ...widget}: BookingWidget) {
    return widget;
}

function personText(value: BookingPerson | undefined): {name: string; email: string} | null {
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

/** A supplier booking as the model reads it. */
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

function mapCancellation(tag: string | undefined): string | undefined {
    if (tag === "RFN") return "refundable";
    if (tag === "NRFN") return "non_refundable";
    return tag;
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
