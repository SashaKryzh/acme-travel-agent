import type {NextConfig} from "next";

const AGENT = "http://127.0.0.1:3200";

const nextConfig: NextConfig = {
    // The browser calls the agent on this origin: eve's session API under /eve/v1 and the hotel page under /acme/v1.
    async rewrites() {
        return {
            beforeFiles: [
                {source: "/eve/v1/:path*", destination: `${AGENT}/eve/v1/:path*`},
                {source: "/acme/v1/:path*", destination: `${AGENT}/acme/v1/:path*`}
            ]
        };
    }
};

export default nextConfig;
