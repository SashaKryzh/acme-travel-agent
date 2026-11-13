import {account} from "@acme/travel";
import {localDev, vercelOidc} from "eve/channels/auth";
import {defaultEveAuth, eveChannel} from "eve/channels/eve";

import {teamAuth} from "../lib/teamAuth";
import {turnContext} from "../lib/turnContext";

export default eveChannel({
    // Teammates with the shared password (SITE_PASSWORD), the project's own Vercel OIDC callers, and localhost in development.
    auth: [teamAuth(), vercelOidc(), localDev()],
    onMessage(ctx) {
        // The turn context is built here, not by the browser, and reaches every model call of the turn
        // without being stored in the session's history.
        return {auth: defaultEveAuth(ctx), clientContext: turnContext(new Date(), account())};
    }
});
