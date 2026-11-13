import {defineTool} from "eve/tools";
import {z} from "zod";

/** A reaction the app shows on the user's latest message. */
export default defineTool({
    availableInSubagents: false,
    description:
        "React to the user's latest message with one emoji. React with 👀 when you start background research on it, and with ✅ when that research is done. Use other emoji sparingly, when a reaction says it better than words.",
    inputSchema: z.object({emoji: z.string().min(1).max(8).describe("One emoji, for example 👀")}),
    label: {start: ({emoji}) => `Reacted ${emoji}`},
    execute: ({emoji}) => ({emoji})
});
