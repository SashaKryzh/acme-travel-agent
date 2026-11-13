import {defineMemory} from "eve/memory";
import {fileMemory} from "eve/memory/file";

/** What the agent remembers about the traveller across chats: in memory under eve dev, in Vercel Blob when deployed. */
export default defineMemory({
    description: "Lasting travel preferences and facts about the traveller, such as breakfast, budget, room type or who they travel with.",
    provider: fileMemory(),
    // The app serves one fictional ACME account.
    scope: "acme-account"
});
