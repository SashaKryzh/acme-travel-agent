import {hotelOffers} from "@acme/travel";

import {
    fail,
    FILTER_PARAMETER_NAMES,
    FILTER_PARAMETER_PROPERTIES,
    filterRatesRequest,
    travelTool,
    mapHotelOffer,
    output,
    rememberOffers,
    STAY_PARAMETER_PROPERTIES,
    stayFrom,
    stayRatesRequest
} from "../lib/travel";

export default travelTool({
    description:
        "Search hotels by mood, style, or preferences for dates. Use when the ask is about vibe or taste: boutique, romantic, quiet spa hotel, family-friendly, a brand, or a hotel name. Put destination and preferences in the query text; do not use for pure area-only searches.",
    parameters: {
        type: "object",
        properties: {
            query: {
                type: "string",
                description: "Mood and preference search text, for example romantic boutique hotel in Lisbon or Crowne Plaza Warsaw"
            },
            ...STAY_PARAMETER_PROPERTIES,
            ...FILTER_PARAMETER_PROPERTIES
        },
        required: ["query", "checkin", "checkout", "adults", "children", "currency", "guest_nationality", "limit", ...FILTER_PARAMETER_NAMES],
        additionalProperties: false
    },
    async run(args, ctx) {
        const query = String(args.query).trim();
        if (query.length === 0) fail("Error: query must not be empty");
        const stay = stayFrom(args, ctx);
        const limit = Number(args.limit);
        const rates = await ctx
            .nuitee()
            .searchRates({...stayRatesRequest(stay, limit, 1), ...filterRatesRequest(args), aiSearch: query}, ctx.abortSignal)
            .catch((error: unknown) => fail(`Error: hotel search failed (${error instanceof Error ? error.message : String(error)})`));
        const offers = hotelOffers(rates, stay.checkin, stay.checkout).slice(0, limit);
        await rememberOffers(ctx, stay, offers);
        const meta = {query, checkin: stay.checkin, checkout: stay.checkout};
        return output({...meta, total: offers.length, hotels: offers}, {...meta, hotels: offers.map(mapHotelOffer)});
    }
});
