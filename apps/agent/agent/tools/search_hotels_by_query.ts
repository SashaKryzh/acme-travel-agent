import {hotelOffers} from "@acme/travel";
import {defineTool} from "eve/tools";
import {z} from "zod";

import {filters, json, mapHotelOffer, ratesRequest, rememberOffers, searchFields, stayFrom, travel} from "../lib/travel";

export default defineTool({
    description:
        "Search hotels by mood, style, or preferences for dates. Use when the ask is about vibe or taste: boutique, romantic, quiet spa hotel, family-friendly, a brand, or a hotel name. Put destination and preferences in the query text; do not use for pure area-only searches.",
    inputSchema: z.object({
        query: z.string().min(1).describe("Mood and preference search text, for example romantic boutique hotel in Lisbon"),
        ...searchFields
    }),
    async execute(input, ctx) {
        const trip = travel(ctx);
        const stay = stayFrom(input, trip);
        const rates = await trip.nuitee().searchRates({...ratesRequest(stay, input.limit, 1), ...filters(input), aiSearch: input.query}, trip.abortSignal);
        const hotels = hotelOffers(rates, stay.checkin, stay.checkout).slice(0, input.limit);
        await rememberOffers(trip, stay, hotels);
        return {query: input.query, checkin: stay.checkin, checkout: stay.checkout, hotels};
    },
    toModelOutput: ({hotels, ...search}) => json({...search, hotels: hotels.map(mapHotelOffer)})
});
