import {mkdir, readFile, rename, writeFile} from "node:fs/promises";
import path from "node:path";

const queues = new Map<string, Promise<unknown>>();

export async function readJson<T>(file: string, fallback: T): Promise<T> {
    try {
        return JSON.parse(await readFile(file, "utf8")) as T;
    } catch (error: unknown) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            return fallback;
        }
        throw error;
    }
}

/** Read-modify-write under a per-file queue, written through a temp file so a crash never leaves half a JSON file. */
export function updateJson<T, R = T>(file: string, fallback: T, update: (current: T) => T | Promise<T>, result?: (next: T) => R): Promise<R> {
    const previous = queues.get(file) ?? Promise.resolve();
    const next = previous.then(async () => {
        const current = await readJson(file, fallback);
        const updated = await update(current);
        await writeJsonAtomic(file, updated);
        return (result === undefined ? updated : result(updated)) as R;
    });
    queues.set(
        file,
        next.catch(() => undefined)
    );
    return next;
}

async function writeJsonAtomic(file: string, value: unknown): Promise<void> {
    await mkdir(path.dirname(file), {recursive: true});
    const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await rename(temp, file);
}
