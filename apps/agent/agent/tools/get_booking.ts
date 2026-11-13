import {defineTool} from "eve/tools";
import {z} from "zod";

import {json, mapBooking, travel} from "../lib/travel";

export default defineTool({
    description: "Fetch a booking by booking_id.",
    inputSchema: z.object({booking_id: z.string()}),
    async execute({booking_id}, ctx) {
        const trip = travel(ctx);
        // Only the user's own bookings: the store holds what this agent booked.
        if ((await trip.store.findBooking((item) => item.booking_id === booking_id)) === undefined) throw new Error("Booking not found");
        const booking = await trip.nuitee().getBooking(booking_id);
        if (booking === undefined) throw new Error("Booking not found");
        return mapBooking(booking);
    },
    toModelOutput: json
});
