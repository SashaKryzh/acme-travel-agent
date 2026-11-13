import {existsSync} from "node:fs";
import path from "node:path";

import type {Account} from "./types";

/**
 * Demo mode serves hotels, booking and web research from the mocked world. It is the default unless both the
 * Nuitee and Exa keys are set, so the project runs with a model key alone. ACME_DEMO=1 or 0 forces it either way.
 */
export function demoMode(): boolean {
    const forced = process.env.ACME_DEMO;
    if (forced === "1") return true;
    if (forced === "0") return false;
    return !hasValue(process.env.NUITEE_API_KEY) || !hasValue(process.env.EXA_API_KEY);
}

/** Bookings take no payment in demo mode and with a LiteAPI sandbox key (sand_...); any other live key books for real. */
export function testBookings(): boolean {
    return demoMode() || (process.env.NUITEE_API_KEY ?? "").startsWith("sand_");
}

export function requiredEnv(name: "NUITEE_API_KEY" | "EXA_API_KEY"): string {
    const value = process.env[name];
    if (!hasValue(value)) throw new Error(`Missing ${name}. Set it in .env.local (see .env.example), or run in demo mode.`);
    return value;
}

/** Demo and live data never mix: each mode keeps its offers, bookings and supplier state in its own folder. */
export function dataDir(): string {
    return process.env.ACME_DATA_DIR ?? path.join(repoRoot(), "data", demoMode() ? "demo" : "live");
}

/** The fictional ACME account this agent works for. */
export function account(): Account {
    const env = process.env;
    return {
        name: env.ACME_USER_NAME || "Sam Rivera",
        email: env.ACME_USER_EMAIL || "sam.rivera@example.com",
        home_city: env.ACME_HOME_CITY || "Tallinn",
        country_code: env.ACME_COUNTRY_CODE || "EE",
        currency: env.ACME_CURRENCY || "EUR",
        language: env.ACME_LANGUAGE || "en",
        time_zone: env.ACME_TIME_ZONE || "Europe/Tallinn"
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
