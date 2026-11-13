import path from "node:path";

import {account, dataDir, demoMode} from "./config";
import {ExaClient, type ExaApi} from "./exa/client";
import {NuiteeClient, type NuiteeApi} from "./nuitee/client";
import {TravelStore} from "./store/store";
import type {Account, RideHistoryApi} from "./types";
import {WorldExa} from "./world/exa";
import {WorldNuitee} from "./world/nuitee";
import {WorldRides} from "./world/rides";
import {loadWorld} from "./world/world";

/** What a tool call works with: the session it belongs to, the store, the account, and the hotel, research and ride clients. */
export interface ToolContext {
    sessionId: string;
    store: TravelStore;
    /** Lazy, so a missing API key only fails the tools that need it. */
    nuitee: () => NuiteeApi;
    exa: () => ExaApi;
    rides: () => RideHistoryApi;
    account: Account;
    now: Date;
    abortSignal?: AbortSignal;
}

interface Clients {
    nuitee: () => NuiteeApi;
    exa: () => ExaApi;
    rides: () => RideHistoryApi;
}

let clients: Clients | undefined;

/** Live LiteAPI and Exa clients from their keys, or the mocked world in demo mode. ACME rides always come from the world. */
function toolClients(): Clients {
    if (clients !== undefined) return clients;
    const rides = new WorldRides();
    if (demoMode()) {
        const world = loadWorld();
        const nuitee = new WorldNuitee(world, path.join(dataDir(), "supplier"));
        const exa = new WorldExa(world);
        clients = {nuitee: () => nuitee, exa: () => exa, rides: () => rides};
    } else {
        let nuitee: NuiteeClient | undefined;
        let exa: ExaClient | undefined;
        clients = {nuitee: () => (nuitee ??= NuiteeClient.fromEnv()), exa: () => (exa ??= ExaClient.fromEnv()), rides: () => rides};
    }
    return clients;
}

export function toolContext(sessionId: string, abortSignal?: AbortSignal): ToolContext {
    return {
        sessionId,
        store: new TravelStore(),
        ...toolClients(),
        account: account(),
        now: new Date(),
        ...(abortSignal === undefined ? {} : {abortSignal})
    };
}
