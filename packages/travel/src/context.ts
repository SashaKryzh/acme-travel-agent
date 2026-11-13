import path from "node:path";

import {account, dataDir, demoMode} from "./config";
import {NuiteeClient, type NuiteeApi} from "./nuitee/client";
import {TravelStore} from "./store/store";
import type {Account, RideHistoryApi} from "./types";
import {WorldNuitee} from "./world/nuitee";
import {WorldRides} from "./world/rides";
import {loadWorld} from "./world/world";

/** What a tool call works with: the session it belongs to, the store, the account, and the hotel, research and ride clients. */
export interface ToolContext {
    sessionId: string;
    store: TravelStore;
    nuitee: () => NuiteeApi;
    rides: () => RideHistoryApi;
    account: Account;
    now: Date;
    abortSignal?: AbortSignal;
}

interface Clients {
    nuitee: () => NuiteeApi;
    rides: () => RideHistoryApi;
}

let clients: Clients | undefined;

/** The live LiteAPI client from its key, or the mocked world in demo mode. ACME rides always come from the world. */
function toolClients(): Clients {
    if (clients !== undefined) return clients;
    const rides = new WorldRides();
    if (demoMode()) {
        const world = loadWorld();
        const nuitee = new WorldNuitee(world, path.join(dataDir(), "supplier"));
        clients = {nuitee: () => nuitee, rides: () => rides};
    } else {
        const nuitee = new NuiteeClient(process.env.NUITEE_API_KEY ?? "");
        clients = {nuitee: () => nuitee, rides: () => rides};
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
