import {fail, travelTool, output} from "../lib/travel";
import {SKILLS} from "../lib/skills";

/** Loads a skill's instructions. eve has its own skills; this tool keeps the prompt's own skill catalog and loading rule. */
export default travelTool({
    description: "Load the instructions of a skill listed under Skills, before doing the task it covers. Returns them as text to follow.",
    parameters: {
        type: "object",
        properties: {name: {type: "string", enum: SKILLS.map((skill) => skill.name), description: "The skill's name."}},
        required: ["name"],
        additionalProperties: false
    },
    async run(args) {
        const skill = SKILLS.find((candidate) => candidate.name === args.name);
        if (skill === undefined) fail("Error: unknown skill");
        return output({name: skill.name}, `<skill_content name="${skill.name}">\n${skill.instructions}\n</skill_content>`);
    }
});
