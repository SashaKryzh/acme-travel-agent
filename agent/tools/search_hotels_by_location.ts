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

const HOTEL_SEARCH_MIN_RADIUS_METERS = 1_000;
const HOTEL_SEARCH_DEFAULT_RADIUS_METERS = 10_000;

export default travelTool({
    description:
        "Search hotels by location or area for dates. Use when the ask is about where to stay: a city, neighbourhood, district, or landmark to be near. Do not use for mood, style, or preference-led searches.",
    parameters: {
        type: "object",
        properties: {
            place: {type: "string", description: "Location or area to geocode, for example Lisbon, Alfama, or Shoreditch"},
            ...STAY_PARAMETER_PROPERTIES,
            radius_meters: {
                type: ["integer", "null"],
                minimum: HOTEL_SEARCH_MIN_RADIUS_METERS,
                description: `Search radius in meters around the geocoded place, minimum ${HOTEL_SEARCH_MIN_RADIUS_METERS}, or null to use ${HOTEL_SEARCH_DEFAULT_RADIUS_METERS}`
            },
            hotel_name: {type: ["string", "null"], description: "Part of a hotel or brand name to match, for example Hilton, or null for any"},
            ...FILTER_PARAMETER_PROPERTIES
        },
        required: ["place", "checkin", "checkout", "adults", "children", "currency", "guest_nationality", "limit", "radius_meters", "hotel_name", ...FILTER_PARAMETER_NAMES],
        additionalProperties: false
    },
    async run(args, ctx) {
        const place = String(args.place).trim();
        if (place.length === 0) fail("Error: place must not be empty");
        const stay = stayFrom(args, ctx);
        const radius = Math.max(Number(args.radius_meters ?? HOTEL_SEARCH_DEFAULT_RADIUS_METERS), HOTEL_SEARCH_MIN_RADIUS_METERS);
        const hotelName = typeof args.hotel_name === "string" && args.hotel_name.trim().length > 0 ? args.hotel_name.trim() : undefined;
        // The place is resolved with Nuitee's places API. With a place id the radius doesn't apply; the demo world
        // also knows the place's center, so there it does.
        const [resolved] = await ctx.nuitee().searchPlaces(place, ctx.abortSignal).catch(() => fail("Error: could not resolve place"));
        if (resolved === undefined) fail("Error: could not resolve place");
        const limit = Number(args.limit);
        const rates = await ctx
            .nuitee()
            .searchRates(
                {
                    ...stayRatesRequest(stay, limit, 1),
                    ...filterRatesRequest(args),
                    ...(resolved.location === undefined
                        ? {placeId: resolved.placeId}
                        : {latitude: resolved.location.latitude, longitude: resolved.location.longitude, radius}),
                    ...(hotelName === undefined ? {} : {hotelName})
                },
                ctx.abortSignal
            )
            .catch((error: unknown) => fail(`Error: hotel search failed (${error instanceof Error ? error.message : String(error)})`));
        const offers = hotelOffers(rates, stay.checkin, stay.checkout).slice(0, limit);
        await rememberOffers(ctx, stay, offers);
        const meta = {
            place,
            resolved_address: `${resolved.displayName}, ${resolved.formattedAddress}`,
            ...(resolved.location === undefined ? {} : {latitude: resolved.location.latitude, longitude: resolved.location.longitude, radius_meters: radius}),
            checkin: stay.checkin,
            checkout: stay.checkout
        };
        return output({...meta, total: offers.length, hotels: offers}, {...meta, hotels: offers.map(mapHotelOffer)});
    }
});
