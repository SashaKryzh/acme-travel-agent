import path from "node:path";

import {dataDir} from "../config";
import type {BookingRecord, PricedOffer, PriceWatch} from "../types";
import {readJson, updateJson} from "./jsonFile";

const ID_PATTERN = /^[A-Za-z0-9_-]+$/;
/** Offers expire at Nuitee within hours; keeping a session's last few hundred is plenty to resolve card clicks. */
const MAX_OFFERS_PER_SESSION = 600;

/**
 * What the agent keeps outside eve's session history: the offers each session has seen, so cards, the hotel page
 * and prebook resolve the short ids the model uses, and the user's bookings. JSON files under data/.
 */
export class TravelStore {
    public constructor(private readonly dir: string = dataDir()) {}

    public saveOffers(sessionId: string, offers: PricedOffer[]): Promise<void> {
        return updateJson<Record<string, PricedOffer>, void>(
            this.offersFile(sessionId),
            {},
            (current) => {
                const merged = {...current};
                for (const offer of offers) merged[offer.offer.offer_id] = offer;
                const entries = Object.entries(merged).sort((a, b) => b[1].saved_at.localeCompare(a[1].saved_at));
                return Object.fromEntries(entries.slice(0, MAX_OFFERS_PER_SESSION));
            },
            () => undefined
        );
    }

    public getOffers(sessionId: string): Promise<Record<string, PricedOffer>> {
        return readJson<Record<string, PricedOffer>>(this.offersFile(sessionId), {});
    }

    public listBookings(): Promise<BookingRecord[]> {
        return readJson<BookingRecord[]>(this.file("bookings.json"), []);
    }

    public async findBooking(predicate: (record: BookingRecord) => boolean): Promise<BookingRecord | undefined> {
        return (await this.listBookings()).find(predicate);
    }

    public upsertBooking(prebookId: string, update: (existing: BookingRecord | undefined) => BookingRecord): Promise<BookingRecord> {
        return updateJson<BookingRecord[], BookingRecord>(
            this.file("bookings.json"),
            [],
            (records) => {
                const existing = records.find((record) => record.prebook_id === prebookId);
                const next = {...update(existing), updated_at: new Date().toISOString()};
                return existing === undefined ? [...records, next] : records.map((record) => (record.prebook_id === prebookId ? next : record));
            },
            (records) => records.find((record) => record.prebook_id === prebookId) as BookingRecord
        );
    }

    public listPriceWatches(): Promise<PriceWatch[]> {
        return readJson<PriceWatch[]>(this.file("price-watches.json"), []);
    }

    public updatePriceWatches<R>(update: (watches: PriceWatch[]) => PriceWatch[] | Promise<PriceWatch[]>, result: (watches: PriceWatch[]) => R): Promise<R> {
        return updateJson<PriceWatch[], R>(this.file("price-watches.json"), [], update, result);
    }

    private offersFile(sessionId: string): string {
        if (!ID_PATTERN.test(sessionId)) throw new Error("Invalid session id");
        return this.file("offers", `${sessionId}.json`);
    }

    private file(...parts: string[]): string {
        return path.join(this.dir, ...parts);
    }
}
