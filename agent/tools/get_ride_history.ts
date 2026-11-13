import {fail, travelTool, output} from "../lib/travel";

const WINDOW_DAYS = 30;
const LIMIT = 100;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export default travelTool({
    description: `Fetch this user's finished ACME rides between two dates. Call it when they ask about rides or places they went with ACME. Pick from_date and to_date from what they asked; leave both null for the last ${WINDOW_DAYS} days. A ride's started time is its scheduled pickup, or the booking time when it was not scheduled.`,
    parameters: {
        type: "object",
        properties: {
            from_date: {
                type: ["string", "null"],
                description: `First day to include, YYYY-MM-DD, in the user's local timezone. Null for ${WINDOW_DAYS} days ago.`
            },
            to_date: {
                type: ["string", "null"],
                description: "Last day to include, YYYY-MM-DD, in the user's local timezone, not after today and not before from_date. Null for today."
            },
            time_zone: {
                type: ["string", "null"],
                description:
                    "IANA time zone, such as Europe/Tallinn. Pass it when the user's zone is unknown, after they name their city or zone. A city name is not a zone. Null when the message already has a zone."
            }
        },
        required: ["from_date", "to_date", "time_zone"],
        additionalProperties: false
    },
    async run(args, ctx) {
        const rides = ctx.rides();
        // The account's zone wins; time_zone covers an account without one.
        const zone = validZone(ctx.account.time_zone) ?? validZone(args.time_zone);
        if (zone === undefined) {
            fail("Error: the user's time zone is unknown. Ask for their city or time zone, then call again with time_zone set to an IANA zone such as Europe/Tallinn.");
        }
        const today = localDay(ctx.now, zone);
        const from = args.from_date ?? addDays(today, -WINDOW_DAYS);
        const to = args.to_date ?? today;
        if (typeof from !== "string" || typeof to !== "string" || !DAY.test(from) || !DAY.test(to) || to > today || from > to) {
            fail("Error: invalid date range. Use YYYY-MM-DD, not after today, with from_date not after to_date.");
        }
        const found = await rides
            .finishedRides(startOfLocalDay(from, zone), startOfLocalDay(addDays(to, 1), zone), LIMIT)
            .catch(() => fail("Error: ride history failed"));
        const history = {
            from_date: from,
            to_date: to,
            rides: found.map((ride) => ({
                started: ride.started,
                pickup: ride.pickup,
                destination: ride.destination,
                price: ride.price,
                currency: ride.currency
            })),
            ...(found.length === LIMIT ? {truncated: true} : {})
        };
        return output(history, history);
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
