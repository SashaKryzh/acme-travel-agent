import {defineInstructions} from "eve/instructions";

import system from "./lib/prompts/system.md?raw";
import {skillCatalog} from "./lib/skills";

/** How this app's booking widget reaches the agent: Pay sends a message instead of booking from the widget itself. */
const APP_NOTES = `## In this app
Tapping Pay on the booking widget sends you a message like "[UI action] The user tapped Pay on the booking widget (prebook_id ...)". That is the user asking to book that room: call book with that prebook_id, and with the holder and primary guest shown on the widget, from <account> unless they gave other details. If a name or email is missing, ask for it first.`;

export default defineInstructions({
    content: `${system.replace(/^---\n[\s\S]*?\n---\n/, "").replace("{{skills}}", skillCatalog()).trim()}\n\n${APP_NOTES}`
});
