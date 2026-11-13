import {defineTool} from "eve/tools";
import {z} from "zod";

import {travel} from "../lib/travel";

const WINDOW_DAYS = 30;
const LIMIT = 100;
const DAY = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export default defineTool({
    description: `Fetch this user's finished ACME rides between two dates. Call it when they ask about rides or places they went with ACME. Pick from_date and to_date from what they asked; leave both null for the last ${WINDOW_DAYS} days. A ride's started time is its scheduled pickup, or the booking time when it was not scheduled.`,
    inputSchema: z.object({
        from_date: DAY.nullable().describe(`First day to include, YYYY-MM-DD, in the user's local timezone. Null for ${WINDOW_DAYS} days ago.`),
        to_date: DAY.nullable().describe("Last day to include, YYYY-MM-DD, in the user's local timezone, not after today and not before from_date. Null for today."),
        time_zone: z
            .string()
            .nullable()
            .describe("IANA time zone, such as Europe/Tallinn. Pass it when the user's zone is unknown, after they name their city or zone. A city name is not a zone. Null when the message already has a zone.")
    }),
    async execute(input, ctx) {
        const trip = travel(ctx);
        // The account's zone wins; time_zone covers an account without one.
        const zone = validZone(trip.account.time_zone) ?? validZone(input.time_zone);
        if (zone === undefined) {
            throw new Error("The user's time zone is unknown. Ask for their city or time zone, then call again with time_zone set to an IANA zone such as Europe/Tallinn.");
        }
        const today = localDay(trip.now, zone);
        const from = input.from_date ?? addDays(today, -WINDOW_DAYS);
        const to = input.to_date ?? today;
        if (to > today || from > to) throw new Error("Invalid date range. Use YYYY-MM-DD, not after today, with from_date not after to_date.");
        const found = await trip.rides().finishedRides(startOfLocalDay(from, zone), startOfLocalDay(addDays(to, 1), zone), LIMIT);
        return {
            from_date: from,
            to_date: to,
            rides: found.map(({started, pickup, destination, price, currency}) => ({started, pickup, destination, price, currency})),
            ...(found.length === LIMIT ? {truncated: true} : {})
        };
    }
});

function validZone(value: unknown): string | undefined {
    if (typeof value !== "string" || value.length === 0) return undefined;
    try {
        new Intl.DateTimeFormat("en-US", {timeZone: value});
        return value;
    } catch {
        return undefined;
    }
}

function localDay(date: Date, zone: string): string {
    return new Intl.DateTimeFormat("en-CA", {timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit"}).format(date);
}

function addDays(day: string, days: number): string {
    return new Date(Date.parse(`${day}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/** Midnight of a local day in the zone, as an instant. */
function startOfLocalDay(day: string, zone: string): Date {
    const guess = new Date(`${day}T00:00:00Z`);
    const local = new Date(guess.toLocaleString("en-US", {timeZone: zone}));
    const utc = new Date(guess.toLocaleString("en-US", {timeZone: "UTC"}));
    return new Date(guess.getTime() - (local.getTime() - utc.getTime()));
}
