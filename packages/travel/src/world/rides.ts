import type {AcmeRide, RideHistoryApi} from "../types";

/** Places the demo traveller rides between in Tallinn, their home city. */
const PLACES = [
    "Tallinn Airport, Tartu mnt 101",
    "Vanalinn, Raekoja plats 1",
    "Telliskivi Creative City, Telliskivi 60a",
    "Ülemiste City, Valukoja 8",
    "Rotermann Quarter, Rotermanni 8",
    "Kadriorg Art Museum, A. Weizenbergi 37",
    "Balti jaam, Toompuiestee 37",
    "Kristiine keskus, Endla 45",
    "Noblessner, Peetri 12",
    "ACME HQ, Lootsi 7"
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
                const started = new Date(day.getTime() + (hour * 60 + ((seed * 13) % 60)) * 60_000 - 2 * 3_600_000);
                if (started < fromInclusive || started >= toExclusive || started > this.now()) continue;
                const airport = from.startsWith("Tallinn Airport") || to.startsWith("Tallinn Airport");
                const price = Math.round(((airport ? 11 : 5) + ((seed + index) % 9) * 0.85) * 100) / 100;
                rides.push({started: tallinnIso(started), pickup: from, destination: to, price, currency: "EUR"});
            }
        }
        return rides.sort((a, b) => b.started.localeCompare(a.started)).slice(0, limit);
    }
}

function startOfDayUtc(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Tallinn is UTC+2 in winter, UTC+3 in summer; the demo shows times with that offset. */
function tallinnIso(date: Date): string {
    const month = date.getUTCMonth();
    const offset = month >= 3 && month <= 9 ? 3 : 2;
    const local = new Date(date.getTime() + offset * 3_600_000);
    return `${local.toISOString().slice(0, 19)}+0${offset}:00`;
}
