"use client";

import {AlertTriangle, Brain, CheckCircle2, ChevronRight, Flag, Info, Loader2, MessageSquare, Sparkles, Wrench, XCircle} from "lucide-react";
import {useEffect, useState, type ReactNode} from "react";

import {cn} from "@/lib/utils";
import type {TraceEvent, TurnTrace} from "@/lib/trace";

/** Every turn of the chat, oldest first: model calls, tool calls with their input and output, and reasoning. The latest is open and live while it runs. */
export function TracePanel({traces, running}: {traces: TurnTrace[]; running: boolean}) {
    if (traces.length === 0) {
        return <p className="rounded-xl border border-dashed p-3 text-xs text-muted-foreground">Send a message to see the agent&apos;s runs step by step.</p>;
    }
    return (
        <div className="space-y-2" data-testid="trace">
            {traces.map((trace, index) => {
                const latest = index === traces.length - 1;
                return <TurnCard key={trace.index} trace={trace} running={latest && running} defaultOpen={latest} />;
            })}
        </div>
    );
}

function TurnCard({trace, running, defaultOpen}: {trace: TurnTrace; running: boolean; defaultOpen: boolean}) {
    const [open, setOpen] = useState(defaultOpen);
    useEffect(() => {
        if (defaultOpen) setOpen(true);
    }, [defaultOpen]);
    const pending = new Set(trace.events.flatMap((event) => (event.kind === "tool_start" ? [event.call_id] : [])));
    for (const event of trace.events) if (event.kind === "tool_end") pending.delete(event.call_id);
    return (
        <div className="space-y-3">
            <button type="button" onClick={() => setOpen((value) => !value)} className="w-full rounded-xl bg-muted/60 p-2.5 text-left text-xs hover:bg-muted">
                <div className="flex items-center gap-1.5 font-medium">
                    {running ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
                    {running ? "Running" : `Turn ${trace.index}`}
                    <span className="font-normal text-muted-foreground">{clock(trace.started_at)}</span>
                    <ChevronRight className={cn("ml-auto size-3.5 text-muted-foreground transition-transform", open && "rotate-90")} />
                </div>
                <div className="mt-1 text-muted-foreground">
                    {seconds(trace.duration_ms)} · {trace.steps} model call{trace.steps === 1 ? "" : "s"} · {tokens(trace.input_tokens)} in
                    {cachedShare(trace.cached_input_tokens, trace.input_tokens)} · {tokens(trace.output_tokens)} out
                    {trace.cost_usd === null ? "" : ` · $${trace.cost_usd.toFixed(4)}`}
                </div>
            </button>
            {open && <ol className="space-y-1">
                {trace.events.map((event, index) => (
                    <TraceRow
                        key={index}
                        event={event}
                        running={running && event.kind === "tool_start" && pending.has(event.call_id)}
                        previous={trace.events.slice(0, index)}
                    />
                ))}
                {running && (
                    <li className="flex items-center gap-2 px-1 py-1 text-xs text-muted-foreground">
                        <Loader2 className="size-3.5 animate-spin" /> working…
                    </li>
                )}
            </ol>}
        </div>
    );
}

function TraceRow({event, running, previous}: {event: TraceEvent; running: boolean; previous: TraceEvent[]}) {
    const [open, setOpen] = useState(false);
    const time = <span className="shrink-0 text-right text-[10px] text-muted-foreground tabular-nums">{seconds(event.at_ms)}</span>;
    const row = (icon: ReactNode, label: ReactNode, detail?: string, expandable?: ReactNode) => (
        <li className="rounded-lg px-1 py-1 text-xs hover:bg-muted/60">
            <button
                type="button"
                disabled={expandable === undefined}
                onClick={() => setOpen((value) => !value)}
                className="grid w-full grid-cols-[3em_auto_minmax(0,1fr)_auto] items-start gap-2 text-left disabled:cursor-default"
            >
                {time}
                <span className="mt-0.5">{icon}</span>
                <span className="min-w-0">
                    <span>{label}</span>
                    {detail !== undefined && <span className="block truncate text-muted-foreground">{detail}</span>}
                </span>
                {expandable !== undefined ? <ChevronRight className={cn("mt-0.5 size-3.5 text-muted-foreground transition-transform", open && "rotate-90")} /> : <span />}
            </button>
            {open && expandable !== undefined && <div className="mt-1 pl-[calc(3em+1.5rem)]">{expandable}</div>}
        </li>
    );
    switch (event.kind) {
        case "step":
            return (
                <li className="flex items-center gap-2 px-1 pt-2 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                    {time} Step {event.step}
                </li>
            );
        case "model": {
            const previousCall = [...previous].reverse().find((item) => item.kind === "model");
            return row(
                <Sparkles className="size-3.5 text-violet-500" />,
                `Model call · ${seconds(event.at_ms - (previousCall?.at_ms ?? 0))}`,
                `${tokens(event.input_tokens)} in${cachedShare(event.cached_input_tokens, event.input_tokens)} · ${tokens(event.output_tokens)} out${event.cost_usd === null ? "" : ` · $${event.cost_usd.toFixed(4)}`}`
            );
        }
        case "reasoning":
            return row(<Brain className="size-3.5 text-muted-foreground" />, "Reasoning", event.text, <Block text={event.text} />);
        case "text":
            return row(<MessageSquare className="size-3.5 text-muted-foreground" />, "Writing the reply");
        case "tool_start":
            return row(
                running ? <Loader2 className="size-3.5 animate-spin text-amber-600" /> : <Wrench className="size-3.5 text-amber-600" />,
                <span className="font-mono">{event.name}</span>,
                event.input,
                <Block label="Input" text={pretty(event.input)} />
            );
        case "tool_end":
            return row(
                event.ok ? <CheckCircle2 className="size-3.5 text-emerald-600" /> : <XCircle className="size-3.5 text-destructive" />,
                <>
                    <span className="font-mono">{event.name}</span> {event.ok ? "returned" : "failed"} · {seconds(event.duration_ms)}
                </>,
                event.output,
                <Block label={event.ok ? "Output" : "Error"} text={pretty(event.output)} />
            );
        case "note":
            return row(<Info className="size-3.5 text-sky-500" />, event.label, event.detail);
        case "error":
            return row(<AlertTriangle className="size-3.5 text-destructive" />, "Error", event.message, <Block text={event.message} />);
        case "finish":
            return row(<Flag className="size-3.5 text-muted-foreground" />, event.outcome === "completed" ? "Done" : `Turn ${event.outcome}`);
    }
}

function Block({label, text}: {label?: string; text: string}) {
    return (
        <div>
            {label !== undefined && <div className="mb-0.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">{label}</div>}
            <pre className="max-h-64 overflow-auto rounded-lg bg-muted p-2 font-mono text-[11px] break-words whitespace-pre-wrap">{text}</pre>
        </div>
    );
}

function pretty(text: string): string {
    try {
        return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
        return text;
    }
}

function clock(at: string): string {
    const date = new Date(at);
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"});
}

function seconds(ms: number): string {
    return `${(ms / 1000).toFixed(1)}s`;
}

function tokens(value: number | null): string {
    if (value === null) return "?";
    return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value);
}

function cachedShare(cached: number | null, input: number | null): string {
    return cached !== null && input !== null && input > 0 ? ` (${Math.round((cached / input) * 100)}% cached)` : "";
}
