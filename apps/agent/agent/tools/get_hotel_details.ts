import {roomOffers, type NuiteeHotelDetails, type NuiteeStaticRoom} from "@acme/travel";

import {fail, travelTool, mapRoomOffer, output, rememberOffers, roomOffer, stayFrom, stayRatesRequest, stripHtml, omitEmpty} from "../lib/travel";

const HOTEL_DETAILS_RATES = 10;

export default travelTool({
    description: `Read one hotel with up to ${HOTEL_DETAILS_RATES} room rates for the stay, for your own reasoning. It shows nothing itself, but show_hotels can show its room offers.`,
    parameters: {
        type: "object",
        properties: {
            hotel_id: {type: "string", description: "Hotel id from search_hotels_by_location or search_hotels_by_query"},
            checkin: {type: "string", description: "Check-in date in YYYY-MM-DD"},
            checkout: {type: "string", description: "Check-out date in YYYY-MM-DD"},
            adults: {type: "integer", description: "Adults in the room"},
            children: {
                type: ["array", "null"],
                items: {type: "integer"},
                description: "Ages of children staying in the room, or null when there are no children"
            },
            currency: {type: ["string", "null"], description: "ISO 4217 code of a currency the user asked for, or null to use their home currency"},
            guest_nationality: {
                type: ["string", "null"],
                description: "ISO 3166-1 alpha-2 code of a nationality the user stated, or null to use their home country"
            }
        },
        required: ["hotel_id", "checkin", "checkout", "adults", "children", "currency", "guest_nationality"],
        additionalProperties: false
    },
    async run(args, ctx) {
        const hotelId = String(args.hotel_id).trim();
        if (hotelId.length === 0) fail("Error: hotel_id must not be empty");
        const stay = stayFrom(args, ctx);
        const failed = (error: unknown) => fail(`Error: hotel details failed (${error instanceof Error ? error.message : String(error)})`);
        const [hotel, rates] = await Promise.all([
            ctx.nuitee().getHotel(hotelId, ctx.abortSignal).catch(failed),
            ctx.nuitee().searchRates({...stayRatesRequest(stay, 1, HOTEL_DETAILS_RATES), hotelIds: [hotelId]}, ctx.abortSignal).catch(failed)
        ]);
        if (hotel === undefined) fail("Error: hotel details failed (hotel not found)");
        const summary = rates.hotels?.[0];
        const rooms = roomOffers(rates.data[0]?.roomTypes).map((room) => roomOffer(hotel.id, summary, room, stay));
        await rememberOffers(ctx, stay, rooms);
        const details = {
            checkin: stay.checkin,
            checkout: stay.checkout,
            hotel_id: hotel.id,
            name: hotel.name,
            available_for_stay: rooms.length > 0,
            rooms: rooms.map(mapRoomOffer),
            room_types: (hotel.rooms ?? []).map(roomType),
            ...hotelFacts(hotel)
        };
        return output({...details, rooms}, omitEmpty(details));
    }
});

function hotelFacts(hotel: NuiteeHotelDetails) {
    return {
        description: stripHtml(hotel.hotelDescription),
        important_information: stripHtml(hotel.hotelImportantInformation),
        address: hotel.address,
        city: hotel.city,
        country: hotel.country,
        location: hotel.location,
        stars: hotel.starRating !== undefined && hotel.starRating > 0 ? hotel.starRating : undefined,
        rating: hotel.rating !== undefined && hotel.rating > 0 ? hotel.rating : undefined,
        review_count: hotel.reviewCount,
        checkin_checkout: hotel.checkinCheckoutTimes,
        policy_notes: hotel.policies?.map((policy) => ({name: policy.name, description: policy.description})),
        facilities: hotel.hotelFacilities
    };
}

/** Room attributes repeat the amenities, so only the amenity names are kept. */
function roomType(room: NuiteeStaticRoom) {
    const beds = (room.bedTypes ?? []).flatMap((bed) =>
        bed.bedType === undefined ? [] : [`${bed.quantity ?? 1} ${bed.bedType}${bed.bedSize === undefined ? "" : ` (${bed.bedSize})`}`]
    );
    return {
        id: room.id,
        name: room.roomName,
        description: stripHtml(room.description),
        size: room.roomSizeSquare,
        size_unit: room.roomSizeUnit,
        max_occupancy: room.maxOccupancy,
        beds: beds.length === 0 ? undefined : beds.join(" or "),
        amenities: room.roomAmenities?.map((amenity) => amenity.name)
    };
}
