import {bookingResult, fail, travelTool, output} from "../lib/travel";

export default travelTool({
    description: "Cancel a booking by booking_id.",
    parameters: {type: "object", properties: {booking_id: {type: "string"}}, required: ["booking_id"], additionalProperties: false},
    async run(args, ctx) {
        const bookingId = String(args.booking_id);
        const record = await ctx.store.findBooking((item) => item.booking_id === bookingId);
        if (record === undefined || record.status === "cancelled") fail("Error: booking not found or already cancelled");
        const result = await ctx
            .nuitee()
            .cancelBooking(bookingId)
            .catch((error: unknown) => fail(`Error: cancel booking failed (${error instanceof Error ? error.message : String(error)})`));
        if (result === undefined) fail("Error: booking not found or already cancelled");
        const updated = await ctx.store.upsertBooking(record.prebook_id, (current) => ({...(current ?? record), status: "cancelled"}));
        return output(
            bookingResult(updated, {
                provider_status: result.status,
                refund_amount: result.refund_amount,
                cancellation_fee: result.cancellation_fee,
                refund_currency: result.currency
            }),
            {
                booking_id: result.bookingId,
                status: result.status,
                currency: result.currency,
                cancellation_fee: result.cancellation_fee,
                refund_amount: result.refund_amount
            }
        );
    }
});
