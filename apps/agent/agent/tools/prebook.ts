import {localDate, type BookingWidget} from "@acme/travel";

import {bookingWidget, fail, travelTool, mapPrebook, mapRoomTerms, output, accountGuest, omitEmpty, prebookTerms} from "../lib/travel";

export default travelTool<BookingWidget>({
    description:
        "Run when the user selects a room to show the room booking widget with the Pay button in your reply. Pass its offer_id. From chat, the user names a room type or room name: take the offer_id from that room in get_hotel_details. Returns the final price and a prebook_id, and attaches the booking widget to your reply. Call it as soon as the room is clear. Do not wait to be asked. Do not say the room is already booked.",
    parameters: {
        type: "object",
        properties: {offer_id: {type: "string", description: "Offer id from hotel search or room rates"}},
        required: ["offer_id"],
        additionalProperties: false
    },
    async run(args, ctx) {
        const offerId = String(args.offer_id);
        const priced = (await ctx.store.getOffers(ctx.sessionId))[offerId];
        if (priced === undefined) fail("Error: unknown offer id, search again or call get_hotel_details for that hotel to refresh it");
        const {offer, stay} = priced;
        if (stay.checkin < localDate(ctx.now, ctx.account.time_zone)) {
            fail(`Error: the check-in date ${stay.checkin} has passed, ask the user for new dates`);
        }
        let prebook;
        try {
            prebook = await ctx.nuitee().prebook(offer.nuitee_offer_id);
        } catch (error: unknown) {
            const details = {
                hotel_id: offer.hotel_id,
                checkin: stay.checkin,
                checkout: stay.checkout,
                adults: stay.adults,
                children: stay.children.length > 0 ? stay.children : null,
                currency: stay.currency,
                guest_nationality: stay.guest_nationality
            };
            return fail(
                `Error: prebook failed (${error instanceof Error ? error.message : String(error)}), the offer may have expired. Call get_hotel_details with ${JSON.stringify(details)}, then prebook the room that matches ${JSON.stringify(mapRoomTerms(offer))}. Tell the user if the price changed. If no room matches, ask the user which one they want.`
            );
        }
        const now = new Date().toISOString();
        const guest = accountGuest(ctx);
        // The widget is prefilled from the ACME account.
        const record = await ctx.store.upsertBooking(prebook.prebookId, () => ({
            prebook_id: prebook.prebookId,
            offer_id: offerId,
            session_id: ctx.sessionId,
            status: "prebooked",
            hotel_id: offer.hotel_id,
            hotel_name: offer.name,
            ...(offer.room_name === undefined ? {} : {room_name: offer.room_name}),
            checkin: stay.checkin,
            checkout: stay.checkout,
            price: prebook.price,
            currency: prebook.currency,
            ...(guest === undefined ? {} : {holder: guest, primary_guest: guest}),
            terms: prebookTerms(prebook),
            created_at: now,
            updated_at: now
        }));
        return output(await bookingWidget(ctx, record), omitEmpty(mapPrebook(prebook)));
    }
});
