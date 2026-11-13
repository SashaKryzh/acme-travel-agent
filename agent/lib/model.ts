import {createOpenAI} from "@ai-sdk/openai";
import type {ModelSelection} from "eve/models";

const DEFAULT_MODEL = "anthropic/claude-sonnet-5.5";
const DEFAULT_CONTEXT_WINDOW_TOKENS = 200_000;

/**
 * The model from the environment, read on every model call. By default AGENT_MODEL is a Vercel AI Gateway id, which
 * eve routes with AI_GATEWAY_API_KEY. With OPENAI_COMPATIBLE_BASE_URL set, it is a model of that Chat Completions
 * server instead; eve has no catalog entry for it, so it gets a context window to know when to compact.
 */
export function modelSelection(): ModelSelection | string {
    const modelId = process.env.AGENT_MODEL || DEFAULT_MODEL;
    const baseURL = process.env.OPENAI_COMPATIBLE_BASE_URL;
    if (baseURL === undefined || baseURL.length === 0) return modelId;
    const provider = createOpenAI({baseURL, apiKey: process.env.OPENAI_COMPATIBLE_API_KEY ?? "", name: "openai-compatible"});
    return {
        model: provider.chat(modelId),
        modelContextWindowTokens: Number(process.env.AGENT_CONTEXT_WINDOW_TOKENS) || DEFAULT_CONTEXT_WINDOW_TOKENS
    };
}
