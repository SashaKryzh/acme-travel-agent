import type {HotelGroup, PricedOffer} from "@acme/travel";
import {defineTool} from "eve/tools";
import {z} from "zod";

import {hotelCard, json, MAX_HOTELS_PER_GROUP, sameStay, travel} from "../lib/travel";

export default defineTool({
    description: `Show up to ${MAX_HOTELS_PER_GROUP} hotels to the user as cards with their photo, price, and rating, best first. One call shows one group for one stay: the same dates, guests, currency, and nationality. Call it again for the same stay to replace its cards, or for another stay to add a group, up to 3 groups. The cards show below your reply.`,
    inputSchema: z.object({
        offer_ids: z
            .array(z.string().min(1))
            .min(1)
            .max(MAX_HOTELS_PER_GROUP)
            .describe("Offer ids from search_hotels_by_location, search_hotels_by_query, or get_hotel_details, all for the same stay, best first"),
        title: z.string().nullable().describe("Short header naming the place or scenario, for example Lisbon old town; the dates and guests are added for you. Null for none")
    }),
    async execute({offer_ids, title}, ctx): Promise<HotelGroup> {
        const offers = await travel(ctx).store.getOffers(ctx.session.id);
        const unknown = offer_ids.filter((offerId) => offers[offerId] === undefined);
        if (unknown.length > 0) throw new Error(`Unknown offer ids, search again to refresh them: ${unknown.join(", ")}`);
        const found = offer_ids.map((offerId) => offers[offerId] as PricedOffer);
        const stay = (found[0] as PricedOffer).stay;
        if (found.some((priced) => !sameStay(priced.stay, stay))) throw new Error("These offers were priced for different stays, call show_hotels once per stay");
        return {title, stay, hotels: found.map((priced) => hotelCard(priced.offer))};
    },
    toModelOutput: ({hotels}) => json({shown: hotels.map(({offer_id, hotel_id, name}) => ({offer_id, hotel_id, name}))})
});
