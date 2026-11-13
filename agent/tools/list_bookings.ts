import {travelTool, output} from "../lib/travel";

const PROVIDER_STATUS: Record<string, string> = {booked: "CONFIRMED", cancelled: "CANCELLED", failed: "FAILED"};

export default travelTool({
    description:
        "List the bookings the user has made, past and upcoming, with booking_id, hotel, dates and status. Use it when the user asks what they booked or does not name a booking.",
    parameters: {type: "object", properties: {}, required: [], additionalProperties: false},
    async run(_args, ctx) {
        const records = await ctx.store.listBookings();
        const list = {
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
        return output(list, list);
    }
});
