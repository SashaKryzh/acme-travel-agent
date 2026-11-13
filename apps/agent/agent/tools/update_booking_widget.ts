import {defineTool} from "eve/tools";
import {z} from "zod";

import {bookingWidget, json, person, travel, widgetForModel} from "../lib/travel";

export default defineTool({
    description:
        "Update the guest details on an existing prebook booking widget and show a new booking widget in the reply so the user can review it and tap Pay. Pass the prebook_id from the booking widget, the holder (first name, last name, email), and the primary guest (first name, last name, email). Call this after the user provides or edits guest details for a prebooked room.",
    inputSchema: z.object({
        prebook_id: z.string().describe("prebook_id of the booking widget to update"),
        holder: person("Person making the booking"),
        primary_guest: person("Primary guest for the room")
    }),
    async execute({prebook_id, holder, primary_guest}, ctx) {
        const trip = travel(ctx);
        const record = await trip.store.findBooking((item) => item.prebook_id === prebook_id);
        if (record === undefined || record.session_id !== trip.sessionId || record.booking_id !== undefined || record.status === "failed") {
            throw new Error("prebook_id was not found or can no longer be edited");
        }
        const updated = await trip.store.upsertBooking(prebook_id, (current) => ({...(current ?? record), holder, primary_guest}));
        return bookingWidget(trip, updated);
    },
    toModelOutput: (widget) => json({...widgetForModel(widget), note: "The old booking widget was replaced with this one. Ask the user to review it and tap Pay."})
});
