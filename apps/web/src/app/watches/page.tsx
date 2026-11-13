"use client";

import {useEffect, useState} from "react";

interface Watch {
    id: string;
    hotel_name: string;
    stay: string;
    currency: string;
    active: boolean;
    target_price: number | null;
    first_price: number | null;
    lowest_price: number | null;
    latest_price: number | null;
    last_checked: string | null;
    alert: boolean;
    history: {at: string; price: number | null}[];
}

/** Every hotel price watch and what the daily job saw. Public on purpose, like the rest of the demo. */
export default function WatchesPage() {
    const [watches, setWatches] = useState<Watch[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch("/acme/v1/price-watches", {cache: "no-store"})
            .then(async (response) => (response.ok ? setWatches(((await response.json()) as {watches: Watch[]}).watches) : setError(`Couldn't load watches (${response.status})`)))
            .catch(() => setError("Couldn't load watches"));
    }, []);

    return (
        <main className="mx-auto max-w-2xl px-4 py-10">
            <h1 className="text-2xl font-semibold">Price watches</h1>
            <p className="mt-1 mb-6 text-sm text-muted-foreground">Checked every morning at 07:00 UTC. Ask the agent to watch a hotel&apos;s price, or to check one now.</p>
            {error !== null && <p className="text-sm text-destructive">{error}</p>}
            {watches === null && error === null && <p className="text-sm text-muted-foreground">Loading…</p>}
            {watches?.length === 0 && <p className="text-sm text-muted-foreground">No watches yet. Try “watch the price of this hotel for me”.</p>}
            <div className="space-y-3">
                {[...(watches ?? [])].reverse().map((watch) => (
                    <section key={watch.id} className="rounded-xl border bg-card p-4 text-sm">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h2 className="font-medium">{watch.hotel_name}</h2>
                                <p className="text-muted-foreground">{watch.stay}</p>
                            </div>
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${watch.alert ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" : watch.active ? "bg-muted" : "bg-muted text-muted-foreground"}`}>
                                {watch.alert ? "Price dropped" : watch.active ? "Watching" : "Stopped"}
                            </span>
                        </div>
                        <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                            <Stat label="Latest" value={money(watch.latest_price, watch.currency)} />
                            <Stat label="Lowest" value={money(watch.lowest_price, watch.currency)} />
                            <Stat label="First" value={money(watch.first_price, watch.currency)} />
                            <Stat label="Target" value={watch.target_price === null ? "Any drop" : money(watch.target_price, watch.currency)} />
                        </dl>
                        <ol className="mt-3 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                            {watch.history.map((point) => (
                                <li key={point.at} className="rounded-md bg-muted px-1.5 py-0.5" title={new Date(point.at).toLocaleString()}>
                                    {new Date(point.at).toLocaleDateString([], {month: "short", day: "numeric"})}: {money(point.price, watch.currency)}
                                </li>
                            ))}
                        </ol>
                    </section>
                ))}
            </div>
        </main>
    );
}

function Stat({label, value}: {label: string; value: string}) {
    return (
        <div>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="font-medium tabular-nums">{value}</dd>
        </div>
    );
}

function money(value: number | null, currency: string): string {
    if (value === null) return "—";
    try {
        return new Intl.NumberFormat(undefined, {style: "currency", currency, maximumFractionDigits: 0}).format(value);
    } catch {
        return `${Math.round(value)} ${currency}`;
    }
}
