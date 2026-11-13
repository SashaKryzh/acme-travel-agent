import {defineTool} from "eve/tools";
import {z} from "zod";

import {json, mapBooking, travel} from "../lib/travel";

export default defineTool({
    description:
        "Fetch the selected room by prebook_id. After book, call it with the same prebook_id to see how the booking went: it returns the booking with its status once the provider confirmed it, and an error while the provider is still confirming it or when the provider rejected it. prebook_id is internal. Do not mention it, and do not say the rate is locked or the room is reserved or booked before it returns a booking with status CONFIRMED.",
    inputSchema: z.object({prebook_id: z.string()}),
    async execute({prebook_id}, ctx) {
        const trip = travel(ctx);
        const record = await trip.store.findBooking((item) => item.prebook_id === prebook_id);
        if (record === undefined) throw new Error("That room is not available");
        if (record.status === "failed") throw new Error("The provider rejected the booking of this room");
        if (record.booking_id === undefined) {
            return {prebook_id, hotel_id: record.hotel_id, price_amount: record.price, price_currency: record.currency, rooms: [{room_name: record.room_name}]};
        }
        const booking = await trip.nuitee().getBooking(record.booking_id);
        if (booking === undefined) throw new Error("The booking was made, but its details could not be loaded now. Do not book again; ask the user to check again later");
        return mapBooking(booking);
    },
    toModelOutput: json
});
