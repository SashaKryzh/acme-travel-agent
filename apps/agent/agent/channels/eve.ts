import {account} from "@acme/travel";
import {localDev} from "eve/channels/auth";
import {defaultEveAuth, eveChannel} from "eve/channels/eve";

import {turnContext} from "../lib/turnContext";

export default eveChannel({
    // Local development only: callers on this machine, including the web app on localhost. Public deploys need real auth.
    auth: localDev(),
    onMessage(ctx) {
        // The turn context is built here, not by the browser, and reaches every model call of the turn
        // without being stored in the session's history.
        return {auth: defaultEveAuth(ctx), clientContext: turnContext(new Date(), account())};
    }
});
