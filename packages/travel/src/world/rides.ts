import type {AcmeRide, RideHistoryApi} from "../types";

/** Places the demo traveller rides between in Warsaw, their home city. */
const PLACES = [
    "Warsaw Chopin Airport",
    "Old Town Market Square",
    "Palace of Culture and Science",
    "Warsaw Central Station",
    "Łazienki Park",
    "Warsaw Uprising Museum",
    "POLIN Museum",
    "Copernicus Science Centre",
    "Praga",
    "ACME HQ, Warsaw"
];

/**
 * A month of finished rides, generated from today's date so the history always looks recent. The same day always
 * gets the same rides, so a demo can be repeated.
 */
export class WorldRides implements RideHistoryApi {
    public constructor(private readonly now: () => Date = () => new Date()) {}

    public async finishedRides(fromInclusive: Date, toExclusive: Date, limit: number): Promise<AcmeRide[]> {
        const today = startOfDayUtc(this.now());
        const rides: AcmeRide[] = [];
        for (let daysAgo = 0; daysAgo < 60; daysAgo++) {
            const day = new Date(today.getTime() - daysAgo * 86_400_000);
            const seed = Math.floor(day.getTime() / 86_400_000);
            // Rides on about half the days: commutes, evenings out and the odd airport run.
            if (seed % 2 === 1 && seed % 7 !== 3) continue;
            const count = 1 + (seed % 3 === 0 ? 1 : 0);
            for (let index = 0; index < count; index++) {
                const from = PLACES[(seed + index * 3) % PLACES.length] as string;
                const to = PLACES[(seed * 7 + index + 5) % PLACES.length] as string;
                if (from === to) continue;
                const hour = 8 + ((seed + index * 5) % 13);
                const started = new Date(day.getTime() + (hour * 60 + ((seed * 13) % 60)) * 60_000 - 3_600_000);
                if (started < fromInclusive || started >= toExclusive || started > this.now()) continue;
                const airport = from.startsWith("Warsaw Chopin Airport") || to.startsWith("Warsaw Chopin Airport");
                const price = Math.round(((airport ? 55 : 25) + ((seed + index) % 9) * 4.25) * 100) / 100;
                rides.push({started: warsawIso(started), pickup: from, destination: to, price, currency: "PLN"});
            }
        }
        return rides.sort((a, b) => b.started.localeCompare(a.started)).slice(0, limit);
    }
}

function startOfDayUtc(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Use Warsaw's actual UTC offset, including the daylight-saving transitions. */
function warsawIso(date: Date): string {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Warsaw",
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
        hourCycle: "h23", timeZoneName: "longOffset"
    }).formatToParts(date).map(({type, value}) => [type, value]));
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${parts.timeZoneName?.replace("GMT", "")}`;
}
