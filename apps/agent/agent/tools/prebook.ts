import {localDate} from "@acme/travel";
import {defineTool} from "eve/tools";
import {z} from "zod";

import {accountGuest, bookingWidget, json, mapRoomTerms, prebookTerms, travel, widgetForModel} from "../lib/travel";

export default defineTool({
    description:
        "Run when the user selects a room to show the room booking widget with the Pay button in your reply. Pass its offer_id. From chat, the user names a room type or room name: take the offer_id from that room in get_hotel_details. Returns the final price and a prebook_id, and attaches the booking widget to your reply. Call it as soon as the room is clear. Do not wait to be asked. Do not say the room is already booked.",
    inputSchema: z.object({offer_id: z.string().describe("Offer id from hotel search or room rates")}),
    async execute({offer_id}, ctx) {
        const trip = travel(ctx);
        const priced = (await trip.store.getOffers(trip.sessionId))[offer_id];
        if (priced === undefined) throw new Error("Unknown offer id, search again or call get_hotel_details for that hotel to refresh it");
        const {offer, stay} = priced;
        if (stay.checkin < localDate(trip.now, trip.account.time_zone)) throw new Error(`The check-in date ${stay.checkin} has passed, ask the user for new dates`);
        const prebook = await trip
            .nuitee()
            .prebook(offer.nuitee_offer_id)
            .catch((error: unknown) => {
                const retry = {hotel_id: offer.hotel_id, checkin: stay.checkin, checkout: stay.checkout, adults: stay.adults, children: stay.children.length > 0 ? stay.children : null};
                throw new Error(
                    `Prebook failed (${error instanceof Error ? error.message : String(error)}), the offer may have expired. Call get_hotel_details with ${JSON.stringify(retry)}, then prebook the room that matches ${JSON.stringify(mapRoomTerms(offer))}. Tell the user if the price changed.`
                );
            });
        const now = new Date().toISOString();
        // The widget is prefilled from the ACME account.
        const guest = accountGuest(trip);
        const record = await trip.store.upsertBooking(prebook.prebookId, () => ({
            prebook_id: prebook.prebookId,
            offer_id,
            session_id: trip.sessionId,
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
        return bookingWidget(trip, record);
    },
    toModelOutput: (widget) => json(widgetForModel(widget))
});
