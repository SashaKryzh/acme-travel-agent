import {hotelOffers, toolContext, type PriceWatch, type ToolContext} from "@acme/travel";

import {ratesRequest} from "./travel";

const HISTORY_MAX = 120;

/** The cheapest price for the watched stay right now, or null when the hotel has no rooms for it. */
export async function currentPrice(trip: ToolContext, watch: PriceWatch): Promise<number | null> {
    const stay = {
        checkin: watch.checkin,
        checkout: watch.checkout,
        adults: watch.adults,
        children: watch.children,
        currency: watch.currency,
        guest_nationality: watch.guest_nationality
    };
    const rates = await trip.nuitee().searchRates({...ratesRequest(stay, 1, 5), hotelIds: [watch.hotel_id]}, trip.abortSignal);
    const prices = hotelOffers(rates, watch.checkin, watch.checkout).map((offer) => offer.price_amount);
    return prices.length === 0 ? null : Math.min(...prices);
}

/** Price every active watch whose stay hasn't started, and record what it costs today. */
export async function checkPriceWatches(trip: ToolContext = toolContext("price-watch"), ids?: string[]): Promise<PriceWatch[]> {
    const today = trip.now.toISOString().slice(0, 10);
    const due = (await trip.store.listPriceWatches()).filter((watch) => watch.active && watch.checkin >= today && (ids === undefined || ids.includes(watch.id)));
    const prices = new Map<string, number | null>();
    await Promise.all(
        due.map(async (watch) => {
            try {
                prices.set(watch.id, await currentPrice(trip, watch));
            } catch (error) {
                console.error(`Price watch ${watch.id} failed`, error);
            }
        })
    );
    const at = new Date().toISOString();
    return trip.store.updatePriceWatches(
        (watches) =>
            watches.map((watch) => {
                if (watch.checkin < today && watch.active) return {...watch, active: false};
                if (!prices.has(watch.id)) return watch;
                return {...watch, history: [...watch.history, {at, price: prices.get(watch.id) ?? null}].slice(-HISTORY_MAX)};
            }),
        (watches) => watches
    );
}

/** What the model and the page read about a watch: first, lowest and latest price, and whether it hit the target. */
export function watchSummary(watch: PriceWatch) {
    const seen = watch.history.flatMap((point) => (point.price === null ? [] : [point.price]));
    const first = seen[0] ?? null;
    const latest = watch.history.at(-1) ?? null;
    const target = watch.target_price ?? first;
    return {
        id: watch.id,
        hotel_id: watch.hotel_id,
        hotel_name: watch.hotel_name,
        stay: `${watch.checkin} to ${watch.checkout}, ${watch.adults} adult${watch.adults === 1 ? "" : "s"}${watch.children.length > 0 ? `, children ${watch.children.join(", ")}` : ""}`,
        currency: watch.currency,
        active: watch.active,
        target_price: watch.target_price,
        first_price: first,
        lowest_price: seen.length === 0 ? null : Math.min(...seen),
        latest_price: latest?.price ?? null,
        last_checked: latest?.at ?? null,
        checks: watch.history.length,
        alert: latest?.price != null && target !== null && (watch.target_price === null ? latest.price < target : latest.price <= target)
    };
}
