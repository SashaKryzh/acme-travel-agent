import type {NextConfig} from "next";

const EVE_AGENT_URL = process.env.EVE_AGENT_URL || "http://127.0.0.1:3200";

const nextConfig: NextConfig = {
    // The browser calls the agent on this origin: eve's session API under /eve/v1 and the hotel page under /acme/v1.
    // On Vercel, vercel.ts routes these paths to the agent service before they reach Next.js.
    async rewrites() {
        return {
            beforeFiles: [
                {source: "/eve/v1/:path*", destination: `${EVE_AGENT_URL}/eve/v1/:path*`},
                {source: "/acme/v1/:path*", destination: `${EVE_AGENT_URL}/acme/v1/:path*`}
            ]
        };
    }
};

export default nextConfig;
