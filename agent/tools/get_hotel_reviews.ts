import {fail, travelTool, output, omitEmpty} from "../lib/travel";

const HOTEL_REVIEWS_LIMIT = 10;

export default travelTool({
    description:
        "Read what guests say about one hotel. Call it only when the user asks about guest opinions or something reviews would answer.",
    parameters: {
        type: "object",
        properties: {hotel_id: {type: "string", description: "Hotel id from a search or get_hotel_details"}},
        required: ["hotel_id"],
        additionalProperties: false
    },
    async run(args, ctx) {
        const hotelId = String(args.hotel_id).trim();
        if (hotelId.length === 0) fail("Error: hotel_id must not be empty");
        const data = await ctx
            .nuitee()
            .getReviews(hotelId, HOTEL_REVIEWS_LIMIT, ctx.abortSignal)
            .catch((error: unknown) => fail(`Error: hotel reviews failed (${error instanceof Error ? error.message : String(error)})`));
        // Reviewer names are left out.
        const reviews = {
            hotel_id: hotelId,
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
        return output(reviews, omitEmpty(reviews));
    }
});
