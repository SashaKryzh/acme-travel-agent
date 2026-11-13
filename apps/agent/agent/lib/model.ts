import {openai} from "@ai-sdk/openai";
import type {ModelSelection} from "eve/models";

/**
 * A Vercel AI Gateway model id by default. With OPENAI_BASE_URL set, AGENT_MODEL is a model of that OpenAI-compatible
 * server instead (the provider reads OPENAI_BASE_URL and OPENAI_API_KEY), and eve gets a context window for it.
 */
export function modelSelection(): ModelSelection | string {
    const modelId = process.env.AGENT_MODEL || "anthropic/claude-sonnet-5.5";
    return process.env.OPENAI_BASE_URL ? {model: openai.chat(modelId), modelContextWindowTokens: 200_000} : modelId;
}
