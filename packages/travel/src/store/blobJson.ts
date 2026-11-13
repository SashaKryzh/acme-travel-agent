import {BlobError, BlobPreconditionFailedError, get, put} from "@vercel/blob";
import path from "node:path";
import {setTimeout} from "node:timers/promises";

import {dataDir, demoMode} from "../config";

function blobPath(file: string): string {
    const relative = path.relative(dataDir(), file);
    if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Invalid storage path");
    return `travel/${process.env.VERCEL_ENV ?? "development"}/${demoMode() ? "demo" : "live"}/${relative}`;
}

async function snapshot<T>(key: string, fallback: T): Promise<{value: T; etag?: string}> {
    const response = await get(key, {access: "private", useCache: false});
    if (response === null) return {value: structuredClone(fallback)};
    if (response.statusCode !== 200) throw new Error("Unexpected storage response");
    return {value: JSON.parse(await new Response(response.stream).text()) as T, etag: response.blob.etag};
}

export async function readBlobJson<T>(file: string, fallback: T): Promise<T> {
    return (await snapshot(blobPath(file), fallback)).value;
}

/** Conditional writes also serialize updates made by different serverless instances. */
export async function updateBlobJson<T, R>(file: string, fallback: T, update: (current: T) => T | Promise<T>, result?: (next: T) => R): Promise<R> {
    const key = blobPath(file);
    for (let attempt = 0; attempt < 8; attempt++) {
        const {value, etag} = await snapshot(key, fallback);
        const next = await update(value);
        try {
            await put(key, JSON.stringify(next), {
                access: "private", addRandomSuffix: false, contentType: "application/json",
                cacheControlMaxAge: 60,
                ...(etag === undefined ? {allowOverwrite: false} : {ifMatch: etag})
            });
            return result === undefined ? next as unknown as R : result(next);
        } catch (error) {
            const conflict = error instanceof BlobPreconditionFailedError ||
                (etag === undefined && error instanceof BlobError && /already exists/i.test(error.message));
            if (!conflict || attempt === 7) throw error;
            await setTimeout(25 * (attempt + 1));
        }
    }
    throw new Error("Storage update failed");
}
