import {randomUUID} from "node:crypto";

import {defineTool} from "eve/tools";
import {z} from "zod";

import {currentPrice, watchSummary} from "../lib/priceWatch";
import {json, stayFields, stayFrom, travel} from "../lib/travel";

export default defineTool({
    description:
        "Watch the price of one hotel for a stay: a scheduled job checks it every morning and records the cheapest price. Use when the user asks to watch, track or alert them about a hotel's price. Checks the price right away too.",
    inputSchema: z.object({
        hotel_id: z.string().min(1).describe("Hotel id from a search or get_hotel_details"),
        hotel_name: z.string().min(1).describe("The hotel's name exactly as a tool returned it"),
        ...stayFields,
        target_price: z.number().positive().nullable().describe("Alert at or below this total for the stay, in the stay's currency, or null to alert on any drop")
    }),
    label: {start: ({hotel_name}) => `Watching ${hotel_name}`},
    async execute(input, ctx) {
        const trip = travel(ctx);
        const stay = stayFrom(input, trip);
        const watch = {
            id: randomUUID().slice(0, 8),
            hotel_id: input.hotel_id,
            hotel_name: input.hotel_name,
            ...stay,
            target_price: input.target_price,
            active: true,
            created_at: new Date().toISOString(),
            history: [] as {at: string; price: number | null}[]
        };
        watch.history.push({at: new Date().toISOString(), price: await currentPrice(trip, watch)});
        await trip.store.updatePriceWatches((watches) => [...watches, watch], () => undefined);
        return {...watchSummary(watch), schedule: "every day at 07:00 UTC", page: "/watches"};
    },
    toModelOutput: (output) => json(output)
});
