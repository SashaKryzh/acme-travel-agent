import {NextResponse, type NextRequest} from "next/server";

// One shared team password for the whole site, set as SITE_PASSWORD. Without it (local development) the site is open.
// After the browser's password prompt, a cookie lets the chat's calls to the agent through; the agent checks the same
// cookie in apps/agent/agent/lib/teamAuth.ts.

const COOKIE = "acme_team";

export async function proxy(request: NextRequest) {
    const password = process.env.SITE_PASSWORD;
    if (!password) return NextResponse.next();
    const token = await teamToken(password);
    if (request.cookies.get(COOKIE)?.value === token) return NextResponse.next();

    const header = request.headers.get("authorization");
    if (header?.startsWith("Basic ")) {
        const decoded = atob(header.slice("Basic ".length));
        if ((await teamToken(decoded.slice(decoded.indexOf(":") + 1))) === token) {
            const response = NextResponse.next();
            response.cookies.set(COOKIE, token, {httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30});
            return response;
        }
    }
    return new NextResponse("Password required", {status: 401, headers: {"WWW-Authenticate": 'Basic realm="ACME Travel", charset="UTF-8"'}});
}

async function teamToken(password: string): Promise<string> {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`acme-team:${password}`));
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
