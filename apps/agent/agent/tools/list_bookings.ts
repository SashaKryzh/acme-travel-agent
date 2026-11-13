import {defineTool} from "eve/tools";
import {z} from "zod";

import {travel} from "../lib/travel";

const PROVIDER_STATUS: Record<string, string> = {booked: "CONFIRMED", cancelled: "CANCELLED", failed: "FAILED"};

export default defineTool({
    description:
        "List the bookings the user has made, past and upcoming, with booking_id, hotel, dates and status. Use it when the user asks what they booked or does not name a booking.",
    inputSchema: z.object({}),
    async execute(_input, ctx) {
        const records = await travel(ctx).store.listBookings();
        return {
            bookings: records
                .filter((record) => record.booking_id !== undefined)
                .sort((a, b) => b.created_at.localeCompare(a.created_at))
                .map((record) => ({
                    booking_id: record.booking_id,
                    status: PROVIDER_STATUS[record.status] ?? record.status.toUpperCase(),
                    checkin: record.checkin,
                    checkout: record.checkout,
                    hotel_id: record.hotel_id,
                    hotel_name: record.hotel_name
                }))
        };
    }
});
