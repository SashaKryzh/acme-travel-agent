import type {HotelGroup, PricedOffer} from "@acme/travel";

import {fail, travelTool, hotelCard, MAX_HOTELS_PER_GROUP, output, sameStay} from "../lib/travel";

const MAX_GROUPS_PER_REPLY = 3;

export default travelTool<HotelGroup>({
    description: `Show up to ${MAX_HOTELS_PER_GROUP} hotels to the user as cards with their photo, price, and rating, best first. One call shows one group for one stay: the same dates, guests, currency, and nationality. Call it again for the same stay to replace its cards, or for another stay to add a group, up to ${MAX_GROUPS_PER_REPLY} groups. The cards show below your reply.`,
    parameters: {
        type: "object",
        properties: {
            offer_ids: {
                type: "array",
                minItems: 1,
                maxItems: MAX_HOTELS_PER_GROUP,
                items: {type: "string"},
                description: "Offer ids from search_hotels_by_location, search_hotels_by_query, or get_hotel_details, all for the same stay, best first"
            },
            title: {
                type: ["string", "null"],
                description:
                    "Short header naming the place or scenario, for example Lisbon old town; the dates and guests are added for you. Null for none"
            }
        },
        required: ["offer_ids", "title"],
        additionalProperties: false
    },
    async run(args, ctx) {
        const offerIds = args.offer_ids as string[];
        if (offerIds.some((offerId) => offerId.trim().length === 0)) fail("Error: offer_ids must contain non-empty strings");
        if (offerIds.length > MAX_HOTELS_PER_GROUP) fail(`Error: show at most ${MAX_HOTELS_PER_GROUP} hotels at a time`);
        const offers = await ctx.store.getOffers(ctx.sessionId);
        const unknown = offerIds.filter((offerId) => offers[offerId] === undefined);
        if (unknown.length > 0) fail(`Error: unknown offer ids, search again to refresh them: ${unknown.join(", ")}`);
        const found = offerIds.map((offerId) => offers[offerId] as PricedOffer);
        const first = found[0] as PricedOffer;
        if (found.some((priced) => !sameStay(priced.stay, first.stay))) {
            fail("Error: these offers were priced for different stays, call show_hotels once per stay");
        }
        const title = typeof args.title === "string" ? args.title : null;
        return output(
            {title, stay: first.stay, hotels: found.map((priced) => hotelCard(priced.offer))},
            {shown: found.map(({offer}) => ({offer_id: offer.offer_id, hotel_id: offer.hotel_id, name: offer.name}))}
        );
    }
});
