import findAStay from "./skills/find-a-stay/SKILL.md?raw";

export interface AgentSkill {
    name: string;
    description: string;
    instructions: string;
}

/** The agent's skills; the model sees the catalog and loads one with the skill tool. */
export const SKILLS: AgentSkill[] = [parseSkill(findAStay)];

export function skillCatalog(): string {
    return SKILLS.map((skill) => `- ${skill.name}: ${skill.description}`).join("\n");
}

/** A SKILL.md: YAML frontmatter with name and a folded description, then the instructions. */
function parseSkill(source: string): AgentSkill {
    const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(source);
    if (match === null) throw new Error("A skill needs frontmatter");
    const frontmatter = match[1] ?? "";
    const name = /^name:\s*(.+)$/m.exec(frontmatter)?.[1]?.trim() ?? "";
    const description = (/^description:\s*>-?\s*\n([\s\S]*)$/m.exec(frontmatter)?.[1] ?? /^description:\s*(.+)$/m.exec(frontmatter)?.[1] ?? "")
        .split("\n")
        .map((line) => line.trim())
        .join(" ")
        .trim();
    return {name, description, instructions: (match[2] ?? "").trim()};
}
