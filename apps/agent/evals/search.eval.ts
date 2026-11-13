import {defineEval} from "eve/evals";

export default defineEval({
    description: "A hotel question gets a search and hotel cards.",
    async test(t) {
        const turn = await t.send("Find me a hotel in Le Marais, Paris for 4 to 6 December, two of us.");
        turn.expectOk();
        t.calledTool("search_hotels_by_location");
        t.calledTool("show_hotels");
    }
});
