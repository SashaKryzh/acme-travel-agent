import {fail, travelTool, mapBooking, output, omitEmpty} from "../lib/travel";

export default travelTool({
    description:
        "Fetch the selected room by prebook_id. After book, call it with the same prebook_id to see how the booking went: it returns the booking with its status once the provider confirmed it, and an error while the provider is still confirming it or when the provider rejected it. prebook_id is internal. Do not mention it, and do not say the rate is locked or the room is reserved or booked before it returns a booking with status CONFIRMED.",
    parameters: {type: "object", properties: {prebook_id: {type: "string"}}, required: ["prebook_id"], additionalProperties: false},
    async run(args, ctx) {
        const prebookId = String(args.prebook_id);
        const record = await ctx.store.findBooking((item) => item.prebook_id === prebookId);
        if (record === undefined) fail("Error: that room is not available");
        if (record.status === "failed") fail("Error: the provider rejected the booking of this room");
        if (record.booking_id !== undefined) {
            const booking = await ctx.nuitee().getBooking(record.booking_id);
            if (booking === undefined) {
                fail("Error: the booking was made, but its details could not be loaded now. Do not book again; ask the user to check again later");
            }
            const model = omitEmpty(mapBooking(booking)) as object;
            return output(model, model);
        }
        const prebook = {
            prebook_id: record.prebook_id,
            hotel_id: record.hotel_id,
            price_amount: record.price,
            price_currency: record.currency,
            rooms: [{room_name: record.room_name}]
        };
        return output(prebook, prebook);
    }
});
