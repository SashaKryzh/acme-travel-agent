import {defineAgent} from "eve";
import {openai} from "eve/models/openai";

export default defineAgent({
    // OpenAI with OPENAI_API_KEY. AGENT_MODEL picks another OpenAI model.
    model: openai(process.env.AGENT_MODEL || "gpt-6.1-sol"),
    limits: {
        // A spending brake: past this much in one chat, eve pauses and asks the user to Continue or Stop.
        // Subagents and the research task count toward it.
        sessionUsage: ({window}) => window.inputTokens - window.cacheReadTokens >= 1_500_000 || window.outputTokens >= 60_000,
        sessionTimeoutMs: 14 * 24 * 60 * 60 * 1_000
    }
});
