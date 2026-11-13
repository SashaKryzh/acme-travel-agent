import {defineAgent} from "eve";
import {openai} from "eve/models/openai";

export default defineAgent({
    description:
        "Research hotels in the background while the conversation goes on, such as every hotel in Krakow for some dates. Give it the city, the dates (or say to pick an example weekend), the guests, and what the user cares about. It replies with a ranked summary and hotel ids.",
    model: openai(process.env.AGENT_MODEL || "gpt-6.1-sol")
});
