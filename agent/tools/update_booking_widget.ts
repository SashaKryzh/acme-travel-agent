import type {BookingPerson, BookingWidget} from "@acme/travel";

import {bookingWidget, fail, travelTool, output, personSchema} from "../lib/travel";

export default travelTool<BookingWidget>({
    description:
        "Update the guest details on an existing prebook booking widget and show a new booking widget in the reply so the user can review it and tap Pay. Pass the prebook_id from the booking widget, the holder (first name, last name, email), and the primary guest (first name, last name, email). Call this after the user provides or edits guest details for a prebooked room.",
    parameters: {
        type: "object",
        properties: {
            prebook_id: {type: "string", description: "prebook_id of the booking widget to update"},
            holder: personSchema("Person making the booking"),
            primary_guest: personSchema("Primary guest for the room")
        },
        required: ["prebook_id", "holder", "primary_guest"],
        additionalProperties: false
    },
    async run(args, ctx) {
        const prebookId = String(args.prebook_id);
        const record = await ctx.store.findBooking((item) => item.prebook_id === prebookId);
        if (record === undefined || record.session_id !== ctx.sessionId || record.booking_id !== undefined || record.status === "failed") {
            fail("Error: prebook_id was not found or can no longer be edited");
        }
        const holder = args.holder as BookingPerson;
        const guest = args.primary_guest as BookingPerson;
        const updated = await ctx.store.upsertBooking(prebookId, (current) => ({...(current ?? record), holder, primary_guest: guest}));
        return output(await bookingWidget(ctx, updated), {
            prebook_id: prebookId,
            status: updated.status,
            guests: [{occupancy_number: 1, ...guest}],
            note: "The old booking widget was replaced with the updated one in your reply. Ask the user to review the updated widget and tap Pay."
        });
    }
});
