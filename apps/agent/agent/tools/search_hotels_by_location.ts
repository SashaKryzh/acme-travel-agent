import {hotelOffers, type HotelOffer} from "@acme/travel";
import {defineTool} from "eve/tools";
import {z} from "zod";

import {filters, json, mapHotelOffer, ratesRequest, rememberOffers, searchFields, stayFrom, travel} from "../lib/travel";

const MIN_RADIUS_METERS = 1_000;
const DEFAULT_RADIUS_METERS = 10_000;

export default defineTool({
    description:
        "Search hotels by location or area for dates. Use when the ask is about where to stay: a city, neighbourhood, district, or landmark to be near. Do not use for mood, style, or preference-led searches.",
    inputSchema: z.object({
        place: z.string().min(1).describe("Location or area to geocode, for example Lisbon, Alfama, or Shoreditch"),
        ...searchFields,
        radius_meters: z
            .number()
            .int()
            .min(MIN_RADIUS_METERS)
            .nullable()
            .describe(`Search radius in meters around the place, minimum ${MIN_RADIUS_METERS}, or null to use ${DEFAULT_RADIUS_METERS}`),
        hotel_name: z.string().nullable().describe("Part of a hotel or brand name to match, for example Hilton, or null for any")
    }),
    async execute(input, ctx) {
        const trip = travel(ctx);
        const stay = stayFrom(input, trip);
        const radius = input.radius_meters ?? DEFAULT_RADIUS_METERS;
        // The place is resolved with Nuitee's places API. With a place id the radius doesn't apply; the demo world
        // also knows the place's center, so there it does.
        const [place] = await trip.nuitee().searchPlaces(input.place, trip.abortSignal);
        if (place === undefined) throw new Error("Could not resolve the place");
        const rates = await trip.nuitee().searchRates(
            {
                ...ratesRequest(stay, input.limit, 1),
                ...filters(input),
                ...(place.location === undefined ? {placeId: place.placeId} : {latitude: place.location.latitude, longitude: place.location.longitude, radius}),
                ...(input.hotel_name ? {hotelName: input.hotel_name} : {})
            },
            trip.abortSignal
        );
        const hotels: HotelOffer[] = hotelOffers(rates, stay.checkin, stay.checkout).slice(0, input.limit);
        await rememberOffers(trip, stay, hotels);
        return {place: input.place, resolved_address: `${place.displayName}, ${place.formattedAddress}`, checkin: stay.checkin, checkout: stay.checkout, hotels};
    },
    toModelOutput: ({hotels, ...search}) => json({...search, hotels: hotels.map(mapHotelOffer)})
});
