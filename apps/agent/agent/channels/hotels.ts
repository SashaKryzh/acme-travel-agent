import {loadHotelPage, OfferNotFoundError, toolContext} from "@acme/travel";
import {defineChannel, GET} from "eve/channels";
import {localDev, routeAuth} from "eve/channels/auth";

/** The hotel page a card opens: details and rooms for the card's stay, from the offers the session has seen. Not a model tool. */
export default defineChannel({
    routes: [
        GET("/acme/v1/hotel-page", async (request) => {
            // The same callers as the chat channel: local development only.
            const auth = await routeAuth(request, localDev());
            if (auth instanceof Response) return auth;
            const url = new URL(request.url);
            const sessionId = url.searchParams.get("sessionId");
            const offerId = url.searchParams.get("offerId");
            if (sessionId === null || offerId === null) return Response.json({error: "sessionId and offerId are required"}, {status: 400});
            try {
                return Response.json(await loadHotelPage(toolContext(sessionId, request.signal), offerId));
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : String(error);
                return Response.json({error: message}, {status: error instanceof OfferNotFoundError ? 404 : 502});
            }
        })
    ]
});
