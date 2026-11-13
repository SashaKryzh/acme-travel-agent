import {requestJson} from "../http";

const EXA_API = "https://api.exa.ai";
const AGENT_REQUEST_TIMEOUT_MS = 10_000;

/** Fixed-price efforts only; xhigh, auto and ultra are metered or expensive. */
export type ExaAgentEffort = "minimal" | "low" | "medium" | "high";

export interface ExaAgentRun {
    id: string;
    status: string;
    stopReason?: string | null;
    output?: {
        text?: string | null;
        grounding?: Array<{citations?: Array<{url: string; title?: string | null}> | null}> | null;
    } | null;
    costDollars?: {total?: number | null} | null;
}

/** What web_search needs from Exa. The demo world implements it with fixed pages. */
export type ExaApi = Pick<ExaClient, "createAgentRun" | "getAgentRun" | "cancelAgentRun">;

/** Exa's research agent: it searches, reads the pages and writes a sourced answer. */
export class ExaClient {
    public constructor(private readonly apiKey: string) {}

    public createAgentRun(request: {query: string; systemPrompt: string; effort: ExaAgentEffort}): Promise<ExaAgentRun> {
        return this.agentCall("/agent/runs", "POST", request);
    }

    public getAgentRun(runId: string): Promise<ExaAgentRun> {
        return this.agentCall(`/agent/runs/${encodeURIComponent(runId)}`, "GET");
    }

    /** A run left behind keeps researching and billing. */
    public cancelAgentRun(runId: string): Promise<ExaAgentRun> {
        return this.agentCall(`/agent/runs/${encodeURIComponent(runId)}/cancel`, "POST", {});
    }

    private async agentCall(path: string, method: "GET" | "POST", body?: unknown): Promise<ExaAgentRun> {
        const response = await requestJson<ExaAgentRun>({
            service: "Exa",
            url: `${EXA_API}${path}`,
            method,
            headers: {"x-api-key": this.apiKey},
            body,
            timeoutMs: AGENT_REQUEST_TIMEOUT_MS
        });
        if (response === undefined) throw new Error(`Exa ${path} returned an empty response`);
        return response;
    }
}
