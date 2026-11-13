import {defineSchedule} from "eve/schedules";

import {checkPriceWatches} from "../lib/priceWatch";

/**
 * The scheduled job behind every price watch: each morning it re-prices the watched stays and records the prices.
 * Once a day because the Vercel Hobby plan allows daily cron jobs only. Plain code, no model call.
 */
export default defineSchedule({
    cron: "0 7 * * *",
    run({waitUntil}) {
        waitUntil(checkPriceWatches());
    }
});
