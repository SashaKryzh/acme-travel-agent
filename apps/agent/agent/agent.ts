import {defineAgent} from "eve";
import {openai} from "eve/models/openai";

export default defineAgent({
    // OpenAI with OPENAI_API_KEY. AGENT_MODEL picks another OpenAI model.
    model: openai(process.env.AGENT_MODEL || "gpt-6.1-sol")
});
