import {fail, travelTool, mapBooking, output, omitEmpty} from "../lib/travel";

export default travelTool({
    description: "Fetch a booking by booking_id.",
    parameters: {type: "object", properties: {booking_id: {type: "string"}}, required: ["booking_id"], additionalProperties: false},
    async run(args, ctx) {
        const bookingId = String(args.booking_id);
        // Only the user's own bookings: the store holds what this agent booked.
        const record = await ctx.store.findBooking((item) => item.booking_id === bookingId);
        if (record === undefined) fail("Error: booking not found");
        const booking = await ctx
            .nuitee()
            .getBooking(bookingId)
            .catch((error: unknown) => fail(`Error: get booking failed (${error instanceof Error ? error.message : String(error)})`));
        if (booking === undefined) fail("Error: booking not found");
        const model = omitEmpty(mapBooking(booking)) as object;
        return output(model, model);
    }
});
