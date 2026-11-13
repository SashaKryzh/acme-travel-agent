import {defineTool} from "eve/tools";
import {z} from "zod";

import {watchSummary} from "../lib/priceWatch";
import {json, travel} from "../lib/travel";

export default defineTool({
    description: "Stop watching a hotel's price. The watch and its price history stay visible, marked stopped.",
    inputSchema: z.object({watch_id: z.string().min(1).describe("Watch id from list_price_watches or watch_hotel_price")}),
    async execute({watch_id}, ctx) {
        const trip = travel(ctx);
        const watch = await trip.store.updatePriceWatches(
            (watches) => watches.map((item) => (item.id === watch_id ? {...item, active: false} : item)),
            (watches) => watches.find((item) => item.id === watch_id)
        );
        if (watch === undefined) throw new Error("No watch with that id");
        return watchSummary(watch);
    },
    toModelOutput: (output) => json(output)
});
