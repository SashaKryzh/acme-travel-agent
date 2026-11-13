export class ApiError extends Error {
    public constructor(
        public readonly service: string,
        public readonly status: number,
        message: string
    ) {
        super(`${service} ${status}: ${message}`);
    }
}

export interface JsonRequest {
    service: string;
    url: string;
    method?: "GET" | "POST" | "PUT";
    headers?: Record<string, string>;
    query?: Record<string, string | number | boolean | undefined>;
    body?: unknown;
    timeoutMs: number;
    signal?: AbortSignal;
}

/** Returns undefined for an empty body, which Nuitee sends for "no rates" and for a missing booking. */
export async function requestJson<T>(request: JsonRequest): Promise<T | undefined> {
    const url = new URL(request.url);
    for (const [key, value] of Object.entries(request.query ?? {})) {
        if (value !== undefined) {
            url.searchParams.set(key, String(value));
        }
    }
    const timeout = AbortSignal.timeout(request.timeoutMs);
    const response = await fetch(url, {
        method: request.method ?? "GET",
        headers: {
            accept: "application/json",
            ...(request.body === undefined ? {} : {"content-type": "application/json"}),
            ...request.headers
        },
        body: request.body === undefined ? undefined : JSON.stringify(request.body),
        signal: request.signal === undefined ? timeout : AbortSignal.any([timeout, request.signal])
    });
    const text = await response.text();
    if (!response.ok) {
        throw new ApiError(request.service, response.status, errorMessage(text));
    }
    return text.length === 0 ? undefined : (JSON.parse(text) as T);
}

function errorMessage(body: string): string {
    try {
        const parsed = JSON.parse(body) as {error?: {message?: string; description?: string} | string; message?: string};
        if (typeof parsed.error === "string") {
            return parsed.error;
        }
        return parsed.error?.message ?? parsed.error?.description ?? parsed.message ?? body.slice(0, 300);
    } catch {
        return body.slice(0, 300);
    }
}
