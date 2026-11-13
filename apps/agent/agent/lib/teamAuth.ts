import {createHash, timingSafeEqual} from "node:crypto";

import type {AuthFn} from "eve/channels/auth";

/**
 * The shared team password (SITE_PASSWORD): the cookie the web app sets after its password prompt, or the password
 * itself as Basic auth. Everyone with the password is one principal, since the demo serves one fictional account.
 * Returns null without SITE_PASSWORD, so production stays closed and local development falls through to localDev().
 */
export function teamAuth(): AuthFn<Request> {
    return (request) => {
        const password = process.env.SITE_PASSWORD;
        if (!password) return null;
        const token = teamToken(password);
        const cookie = /(?:^|;\s*)acme_team=([a-f0-9]{64})/.exec(request.headers.get("cookie") ?? "")?.[1];
        const header = request.headers.get("authorization");
        const basic = header?.startsWith("Basic ") ? Buffer.from(header.slice("Basic ".length), "base64").toString("utf8") : undefined;
        const supplied = cookie ?? (basic === undefined ? undefined : teamToken(basic.slice(basic.indexOf(":") + 1)));
        if (supplied === undefined || !timingSafeEqual(Buffer.from(supplied), Buffer.from(token))) return null;
        return {authenticator: "team", principalId: "acme-team", principalType: "user", attributes: {}};
    };
}

function teamToken(password: string): string {
    return createHash("sha256").update(`acme-team:${password}`).digest("hex");
}
