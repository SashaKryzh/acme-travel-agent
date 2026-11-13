import {defineTool} from "eve/tools";
import {z} from "zod";

import {bookingResult, travel} from "../lib/travel";

export default defineTool({
    description: "Cancel a booking by booking_id.",
    inputSchema: z.object({booking_id: z.string()}),
    async execute({booking_id}, ctx) {
        const trip = travel(ctx);
        const record = await trip.store.findBooking((item) => item.booking_id === booking_id);
        if (record === undefined || record.status === "cancelled") throw new Error("Booking not found or already cancelled");
        const result = await trip.nuitee().cancelBooking(booking_id);
        if (result === undefined) throw new Error("Booking not found or already cancelled");
        const updated = await trip.store.upsertBooking(record.prebook_id, (current) => ({...(current ?? record), status: "cancelled"}));
        return bookingResult(updated, {
            provider_status: result.status,
            refund_amount: result.refund_amount,
            cancellation_fee: result.cancellation_fee,
            refund_currency: result.currency
        });
    }
});
