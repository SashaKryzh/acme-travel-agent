import {existsSync} from "node:fs";
import path from "node:path";

import type {Account} from "./types";

/** Demo mode serves hotels, booking and web research from the mocked world unless both live keys are set. */
export function demoMode(): boolean {
    return !hasValue(process.env.NUITEE_API_KEY) || !hasValue(process.env.EXA_API_KEY);
}

/** Demo and live data never mix: each mode keeps its offers, bookings and supplier state in its own folder. */
export function dataDir(): string {
    return path.join(repoRoot(), "data", demoMode() ? "demo" : "live");
}

/** The fictional ACME account this agent works for. */
export function account(): Account {
    return {
        name: "Sam Rivera",
        email: "sam.rivera@example.com",
        home_city: "Tallinn",
        country_code: "EE",
        currency: "EUR",
        language: "en",
        time_zone: "Europe/Tallinn"
    };
}

/** The data folder sits at the workspace root, wherever eve runs the agent from inside it. */
function repoRoot(): string {
    let dir = process.cwd();
    while (!existsSync(path.join(dir, "pnpm-workspace.yaml"))) {
        const parent = path.dirname(dir);
        if (parent === dir) return process.cwd();
        dir = parent;
    }
    return dir;
}

function hasValue(value: string | undefined): value is string {
    return value !== undefined && value.trim().length > 0;
}
