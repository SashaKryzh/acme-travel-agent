import {defineTool} from "eve/tools";
import {z} from "zod";

import {checkPriceWatches, watchSummary} from "../lib/priceWatch";
import {json, travel} from "../lib/travel";

export default defineTool({
    description:
        "List the hotel price watches with their first, lowest and latest price, and whether a watch hit its target. Pass refresh true to check prices right now instead of waiting for the morning job.",
    inputSchema: z.object({refresh: z.boolean().describe("True to check the active watches' prices now")}),
    async execute({refresh}, ctx) {
        const trip = travel(ctx);
        const watches = refresh ? await checkPriceWatches(trip) : await trip.store.listPriceWatches();
        return {watches: watches.map(watchSummary), page: "/watches"};
    },
    toModelOutput: (output) => json(output)
});
