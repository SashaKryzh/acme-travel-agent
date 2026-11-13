import type {ExaAgentRun, ExaApi} from "../exa/client";

import type {World, WorldPage} from "./world";

/** Exa's research agent over the world's fixed pages: it answers at once from the best matching pages. */
export class WorldExa implements ExaApi {
    private readonly runs = new Map<string, ExaAgentRun>();

    public constructor(private readonly world: World) {}

    public async createAgentRun(request: {query: string}): Promise<ExaAgentRun> {
        const pages = this.relevant(request.query);
        const run: ExaAgentRun = {
            id: `run_${this.runs.size + 1}`,
            status: "completed",
            output: {
                text: pages.length === 0 ? "No sources found for this question." : pages.map((item) => `${item.title}: ${item.text}`).join("\n\n"),
                grounding: [{citations: pages.map((item) => ({url: item.url, title: item.title}))}]
            },
            costDollars: {total: 0}
        };
        this.runs.set(run.id, run);
        return run;
    }

    public async getAgentRun(runId: string): Promise<ExaAgentRun> {
        const run = this.runs.get(runId);
        if (run === undefined) throw new Error(`Exa 404: no run ${runId}`);
        return run;
    }

    public async cancelAgentRun(runId: string): Promise<ExaAgentRun> {
        return this.getAgentRun(runId);
    }

    /** Research reads the best pages only: up to three, and none that match much less than the best one. */
    private relevant(query: string): WorldPage[] {
        const ranked = this.rank(query);
        const best = ranked[0] === undefined ? 0 : this.score(ranked[0], query);
        return ranked.filter((item) => this.score(item, query) * 2 >= best).slice(0, 3);
    }

    private score(item: WorldPage, query: string): number {
        const text = query.toLowerCase();
        return item.keywords.filter((keyword) => text.includes(keyword)).length;
    }

    /** Pages about the city the query names, if it names one, by how many of their keywords it mentions. */
    private rank(query: string): WorldPage[] {
        const text = query.toLowerCase();
        const cities = new Set(
            this.world.places
                .filter((place) => [place.city, ...place.aliases].some((name) => text.includes(name.toLowerCase())))
                .map((place) => place.city.toLowerCase())
        );
        return this.world.pages
            .filter((item) => cities.size === 0 || item.keywords.some((keyword) => cities.has(keyword)))
            .map((item) => ({item, score: item.keywords.filter((keyword) => text.includes(keyword)).length}))
            .filter((match) => match.score > 0)
            .sort((a, b) => b.score - a.score || b.item.published.localeCompare(a.item.published))
            .map(({item}) => item);
    }
}
