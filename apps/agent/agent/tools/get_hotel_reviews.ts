import {defineTool} from "eve/tools";
import {z} from "zod";

import {json, travel} from "../lib/travel";

export default defineTool({
    description: "Read what guests say about one hotel. Call it only when the user asks about guest opinions or something reviews would answer.",
    inputSchema: z.object({hotel_id: z.string().min(1).describe("Hotel id from a search or get_hotel_details")}),
    async execute({hotel_id}, ctx) {
        const trip = travel(ctx);
        const data = await trip.nuitee().getReviews(hotel_id, 10, trip.abortSignal);
        // Reviewer names are left out.
        return {
            hotel_id,
            total_reviews: data.total,
            summary: data.sentimentAnalysis,
            latest_reviews: data.data.map((review) => ({
                score: review.averageScore,
                date: review.date?.slice(0, "YYYY-MM-DD".length),
                traveller_type: review.type,
                country: review.country,
                language: review.language,
                headline: review.headline,
                pros: review.pros,
                cons: review.cons
            }))
        };
    },
    toModelOutput: json
});
