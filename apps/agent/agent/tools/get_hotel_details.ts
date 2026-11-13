import {roomOffers, type NuiteeHotelDetails, type NuiteeStaticRoom} from "@acme/travel";
import {defineTool} from "eve/tools";
import {z} from "zod";

import {json, mapRoomOffer, ratesRequest, rememberOffers, roomOffer, stayFields, stayFrom, stripHtml, travel} from "../lib/travel";

const RATES = 10;

export default defineTool({
    description: `Read one hotel with up to ${RATES} room rates for the stay, for your own reasoning. It shows nothing itself, but show_hotels can show its room offers.`,
    inputSchema: z.object({
        hotel_id: z.string().min(1).describe("Hotel id from search_hotels_by_location or search_hotels_by_query"),
        ...stayFields
    }),
    async execute(input, ctx) {
        const trip = travel(ctx);
        const stay = stayFrom(input, trip);
        const [hotel, rates] = await Promise.all([
            trip.nuitee().getHotel(input.hotel_id, trip.abortSignal),
            trip.nuitee().searchRates({...ratesRequest(stay, 1, RATES), hotelIds: [input.hotel_id]}, trip.abortSignal)
        ]);
        if (hotel === undefined) throw new Error("Hotel not found");
        const rooms = roomOffers(rates.data[0]?.roomTypes).map((room) => roomOffer(hotel.id, rates.hotels?.[0], room, stay));
        await rememberOffers(trip, stay, rooms);
        return {
            checkin: stay.checkin,
            checkout: stay.checkout,
            hotel_id: hotel.id,
            name: hotel.name,
            available_for_stay: rooms.length > 0,
            rooms,
            room_types: (hotel.rooms ?? []).map(roomType),
            ...hotelFacts(hotel)
        };
    },
    toModelOutput: ({rooms, ...details}) => json({...details, rooms: rooms.map(mapRoomOffer)})
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
