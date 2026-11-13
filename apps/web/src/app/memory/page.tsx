import {get, list} from "@vercel/blob";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

export const dynamic = "force-dynamic";

/** What the agent remembers about the demo traveller, read from eve's file memory in Vercel Blob. Public on purpose. */
export default async function MemoryPage() {
    const memory = await readMemory();
    return (
        <main className="mx-auto max-w-2xl px-4 py-10">
            <h1 className="mb-6 text-2xl font-semibold">Agent memory</h1>
            {memory === null ? (
                <p className="text-muted-foreground">Nothing remembered yet. Tell the agent a lasting preference, such as “I always want breakfast included”.</p>
            ) : (
                <article className="prose-chat">
                    <Markdown remarkPlugins={[remarkGfm]}>{memory}</Markdown>
                </article>
            )}
        </main>
    );
}

async function readMemory(): Promise<string | null> {
    if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
    const {blobs} = await list({prefix: "eve/memory/file/"});
    const documents = blobs.filter((blob) => blob.pathname.endsWith("/MEMORY.md"));
    const texts = await Promise.all(
        documents.map(async (blob) => {
            const response = await get(blob.pathname, {access: "private", useCache: false});
            return response?.statusCode === 200 ? await new Response(response.stream).text() : "";
        })
    );
    const text = texts.join("\n\n").trim();
    return text === "" ? null : text;
}
