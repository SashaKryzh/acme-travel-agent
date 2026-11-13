import type {BookingPerson} from "@acme/travel";

import {bookingResult, fail, travelTool, mapBooking, output, personSchema, omitEmpty} from "../lib/travel";

export default travelTool({
    description:
        "Book the stay the user just asked to book. Pass the prebook_id from prebook, the holder, and one primary guest: first name, last name, and email. One room is booked; how many people stay was already set during search. Call it only after they ask to book. Do not ask for a card.",
    parameters: {
        type: "object",
        properties: {
            prebook_id: {type: "string", description: "prebook_id returned by prebook"},
            holder: personSchema("Person making the booking"),
            primary_guest: personSchema("Primary guest for the room. The other people staying were already counted during search")
        },
        required: ["prebook_id", "holder", "primary_guest"],
        additionalProperties: false
    },
    async run(args, ctx) {
        const prebookId = String(args.prebook_id);
        const holder = args.holder as BookingPerson;
        const guest = args.primary_guest as BookingPerson;
        const record = await ctx.store.findBooking((item) => item.prebook_id === prebookId);
        if (record === undefined || record.session_id !== ctx.sessionId) fail("Error: prebook_id was not found");
        const nuitee = ctx.nuitee();
        // The prebook id is the client reference, so a retried book finds the first booking instead of booking twice.
        let booking;
        try {
            booking =
                (await nuitee.listBookingsByClientReference(prebookId))[0] ??
                (await nuitee.book({
                    prebookId,
                    clientReference: prebookId,
                    holder: {firstName: holder.first_name, lastName: holder.last_name, email: holder.email},
                    guests: [{occupancyNumber: 1, firstName: guest.first_name, lastName: guest.last_name, email: guest.email}],
                    payment: {method: "ACC_CREDIT_CARD"}
                }));
        } catch (error: unknown) {
            return fail(`Error: book failed (${error instanceof Error ? error.message : String(error)})`);
        }
        const updated = await ctx.store.upsertBooking(prebookId, (current) => ({
            ...(current ?? record),
            status: booking.status === "CONFIRMED" ? "booked" : "failed",
            booking_id: booking.bookingId,
            holder,
            primary_guest: guest,
            ...(booking.hotelConfirmationCode === undefined ? {} : {hotel_confirmation_code: booking.hotelConfirmationCode}),
            ...(booking.price === undefined ? {} : {price: booking.price}),
            ...(booking.currency === undefined ? {} : {currency: booking.currency})
        }));
        return output(bookingResult(updated, {provider_status: booking.status}), omitEmpty(mapBooking(booking)));
    }
});
