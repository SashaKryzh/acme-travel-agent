import type {Account, Stay} from "./types";

export interface StayInput {
    checkin: string;
    checkout: string;
    adults: number;
    children: number[] | null;
    currency: string | null;
    guest_nationality: string | null;
}

/** Check-in today or later in the user's zone, check-out after it, and currency and nationality from the account. */
export function resolveStay(input: StayInput, account: Account, now: Date): Stay {
    const today = localDate(now, account.time_zone);
    if (input.checkin < today) throw new Error(`checkin must be today (${today}) or later`);
    if (input.checkout <= input.checkin) throw new Error("checkout must be after checkin");
    const nationality = input.guest_nationality ?? (account.country_code.length === 2 ? account.country_code : null);
    if (nationality === null) throw new Error("Home country is unknown; pass the destination country's code as guest_nationality");
    return {
        checkin: input.checkin,
        checkout: input.checkout,
        adults: input.adults,
        children: input.children ?? [],
        currency: (input.currency ?? (account.currency || "EUR")).toUpperCase(),
        guest_nationality: nationality.toUpperCase()
    };
}

export function nights(checkin: string, checkout: string): number {
    return Math.max(1, Math.round((Date.parse(checkout) - Date.parse(checkin)) / 86_400_000));
}

export function localDate(now: Date, timeZone: string): string {
    try {
        return new Intl.DateTimeFormat("en-CA", {timeZone, year: "numeric", month: "2-digit", day: "2-digit"}).format(now);
    } catch {
        return now.toISOString().slice(0, 10);
    }
}

export function stayKey(stay: Stay): string {
    return [stay.checkin, stay.checkout, stay.adults, stay.children.join("."), stay.currency, stay.guest_nationality].join("|");
}

export function isRefundable(tag: string | undefined): boolean {
    return tag === "RFN";
}
