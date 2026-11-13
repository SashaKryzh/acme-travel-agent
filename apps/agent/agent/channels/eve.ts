import {account} from "@acme/travel";
import {localDev, none, vercelOidc} from "eve/channels/auth";
import {defaultEveAuth, eveChannel} from "eve/channels/eve";

import {turnContext} from "../lib/turnContext";

export default eveChannel({
    // Public demo with one fictional account; Vercel OIDC also supports authenticated CLI access.
    auth: [vercelOidc(), localDev(), none()],
    onMessage(ctx) {
        // The turn context is built here, not by the browser, and reaches every model call of the turn
        // without being stored in the session's history.
        return {auth: defaultEveAuth(ctx), clientContext: turnContext(new Date(), account())};
    }
});
