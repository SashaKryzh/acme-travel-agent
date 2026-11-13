import {defineTool} from "eve/tools";
import {always} from "eve/tools/approval";
import {z} from "zod";

import {bookingResult, json, mapCancellationPolicy, person, travel} from "../lib/travel";

export default defineTool({
    description:
        "Book the stay the user just asked to book. Pass the prebook_id from prebook, the holder, and one primary guest: first name, last name, and email. One room is booked; how many people stay was already set during search. Call it only after they ask to book. Do not ask for a card.",
    inputSchema: z.object({
        prebook_id: z.string().describe("prebook_id returned by prebook"),
        holder: person("Person making the booking"),
        primary_guest: person("Primary guest for the room. The other people staying were already counted during search")
    }),
    // The user's Pay on the booking widget is eve's approval of this call.
    approval: {
        request: always(),
        prompt: ({input}) => `Pay and book this stay for ${input.primary_guest.first_name} ${input.primary_guest.last_name}?`
    },
    async execute({prebook_id, holder, primary_guest}, ctx) {
        const trip = travel(ctx);
        const record = await trip.store.findBooking((item) => item.prebook_id === prebook_id);
        if (record === undefined || record.session_id !== trip.sessionId) throw new Error("prebook_id was not found");
        const nuitee = trip.nuitee();
        // The prebook id is the client reference, so a retried book finds the first booking instead of booking twice.
        const booking =
            (await nuitee.listBookingsByClientReference(prebook_id))[0] ??
            (await nuitee.book({
                prebookId: prebook_id,
                clientReference: prebook_id,
                holder: {firstName: holder.first_name, lastName: holder.last_name, email: holder.email},
                guests: [{occupancyNumber: 1, firstName: primary_guest.first_name, lastName: primary_guest.last_name, email: primary_guest.email}],
                payment: {method: "ACC_CREDIT_CARD"}
            }));
        const updated = await trip.store.upsertBooking(prebook_id, (current) => ({
            ...(current ?? record),
            status: booking.status === "CONFIRMED" ? "booked" : "failed",
            booking_id: booking.bookingId,
            holder,
            primary_guest,
            ...(booking.hotelConfirmationCode === undefined ? {} : {hotel_confirmation_code: booking.hotelConfirmationCode}),
            ...(booking.price === undefined ? {} : {price: booking.price}),
            ...(booking.currency === undefined ? {} : {currency: booking.currency})
        }));
        return {...bookingResult(updated, {provider_status: booking.status}), ...mapCancellationPolicy(booking.cancellationPolicies)};
    },
    // The model reads the supplier's status, CONFIRMED once booked.
    toModelOutput: ({status: _status, provider_status, ...result}) => json({...result, status: provider_status})
});
