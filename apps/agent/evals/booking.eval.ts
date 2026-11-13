import {defineEval} from "eve/evals";

export default defineEval({
    description: "Pay books the room, and a confirmed cancellation refunds it.",
    async test(t) {
        const search = await t.send("Find me a refundable hotel in Le Marais, Paris for 4 to 6 December, two of us.");
        search.expectOk();

        // book waits for the user's approval, which the booking widget's Pay button gives.
        const pick = await search.session.send("Book the first refundable room you found for us.");
        pick.expectOk();
        t.calledTool("prebook");
        const paid = await pick.session.respondAll("approve");
        paid.expectOk();
        t.calledTool("book", {output: /"status":"booked"/});

        const cancel = await paid.session.send("Cancel that booking, please.");
        cancel.expectOk();
        const cancelled = await cancel.session.respondAll("approve");
        cancelled.expectOk();
        t.calledTool("cancel_booking", {output: /"refund_amount":[1-9]/});
    }
});
