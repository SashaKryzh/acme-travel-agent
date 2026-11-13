import path from "node:path";

import {loadEnvConfig} from "@next/env";
import type {NextConfig} from "next";

// One .env.local at the repo root serves the agent and the web app.
loadEnvConfig(path.resolve(process.cwd(), "../.."));

const EVE_AGENT_URL = process.env.EVE_AGENT_URL || "http://127.0.0.1:3200";

const nextConfig: NextConfig = {
    // The domain package ships TypeScript source.
    transpilePackages: ["@acme/travel"],
    // The browser talks to the eve agent on this origin; eve's own Next.js integration proxies the same way.
    async rewrites() {
        return {beforeFiles: [{source: "/eve/v1/:path*", destination: `${EVE_AGENT_URL}/eve/v1/:path*`}]};
    }
};

export default nextConfig;
