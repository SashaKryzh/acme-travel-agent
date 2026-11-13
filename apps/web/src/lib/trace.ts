import type {SessionStreamEvent} from "eve/client";

/** One row of the trace panel. Times are milliseconds since the turn started. */
export type TraceEvent =
    | {kind: "step"; at_ms: number; step: number}
    | {kind: "model"; at_ms: number; input_tokens: number | null; cached_input_tokens: number | null; output_tokens: number | null; cost_usd: number | null}
    | {kind: "reasoning"; at_ms: number; text: string}
    | {kind: "text"; at_ms: number}
    | {kind: "tool_start"; at_ms: number; call_id: string; name: string; input: string}
    | {kind: "tool_end"; at_ms: number; call_id: string; name: string; ok: boolean; duration_ms: number; output: string}
    | {kind: "note"; at_ms: number; label: string; detail?: string}
    | {kind: "error"; at_ms: number; message: string}
    | {kind: "finish"; at_ms: number; outcome: string};

export interface TurnTrace {
    events: TraceEvent[];
    duration_ms: number;
    steps: number;
    input_tokens: number | null;
    cached_input_tokens: number | null;
    output_tokens: number | null;
    cost_usd: number | null;
}

const INPUT_MAX = 2_000;
const OUTPUT_MAX = 600;

/** The latest turn's timeline, read from the session's eve events: model calls, reasoning, tool calls and the outcome. */
export function latestTurnTrace(events: readonly SessionStreamEvent[]): TurnTrace | null {
    const start = events.findLastIndex((event) => event.type === "turn.started");
    if (start === -1) return null;
    const turn = events.slice(start);
    const startedAt = Date.parse(turn[0]?.meta.at ?? "");
    const at = (event: SessionStreamEvent) => Date.parse(event.meta.at) - startedAt;
    const trace: TurnTrace = {events: [], duration_ms: 0, steps: 0, input_tokens: null, cached_input_tokens: null, output_tokens: null, cost_usd: null};
    const calls = new Map<string, {name: string; at: number}>();
    const textParts = new Set<string>();
    for (const event of turn) {
        trace.duration_ms = Math.max(trace.duration_ms, at(event));
        switch (event.type) {
            case "model.requested":
                trace.steps += 1;
                trace.events.push({kind: "step", at_ms: at(event), step: trace.steps});
                break;
            case "model.retried":
                trace.events.push({kind: "note", at_ms: at(event), label: "eve retried the model call"});
                break;
            case "content.delta":
                if ((event.data.kind ?? "text") === "text" && !textParts.has(event.data.partId)) {
                    textParts.add(event.data.partId);
                    trace.events.push({kind: "text", at_ms: at(event)});
                }
                break;
            case "content.completed":
                if (event.data.kind === "reasoning" && typeof event.data.value === "string" && event.data.value.trim().length > 0) {
                    trace.events.push({kind: "reasoning", at_ms: at(event), text: event.data.value.trim()});
                }
                break;
            case "call.requested":
                if (event.data.capability.kind !== "tool" && event.data.capability.kind !== "skill") break;
                calls.set(event.data.callId, {name: event.data.capability.name, at: at(event)});
                trace.events.push({
                    kind: "tool_start",
                    at_ms: at(event),
                    call_id: event.data.callId,
                    name: event.data.capability.name,
                    input: preview(event.data.input ?? {}, INPUT_MAX)
                });
                break;
            case "call.settled": {
                const call = calls.get(event.data.callId);
                if (call === undefined) break;
                calls.delete(event.data.callId);
                const ok = event.data.outcome === "completed";
                trace.events.push({
                    kind: "tool_end",
                    at_ms: at(event),
                    call_id: event.data.callId,
                    name: call.name,
                    ok,
                    duration_ms: at(event) - call.at,
                    output: ok ? preview(event.data.output, OUTPUT_MAX) : (event.data.error?.message ?? event.data.outcome)
                });
                break;
            }
            case "usage.recorded": {
                if (event.data.kind !== "model") break;
                const usage = event.data.usage;
                trace.input_tokens = add(trace.input_tokens, usage.inputTokens);
                trace.cached_input_tokens = add(trace.cached_input_tokens, usage.cacheReadTokens);
                trace.output_tokens = add(trace.output_tokens, usage.outputTokens);
                trace.cost_usd = add(trace.cost_usd, usage.costUsd);
                trace.events.push({
                    kind: "model",
                    at_ms: at(event),
                    input_tokens: usage.inputTokens ?? null,
                    cached_input_tokens: usage.cacheReadTokens ?? null,
                    output_tokens: usage.outputTokens ?? null,
                    cost_usd: usage.costUsd ?? null
                });
                break;
            }
            case "context.started":
                trace.events.push({kind: "note", at_ms: at(event), label: event.data.kind === "compaction" ? "eve is compacting the history" : "eve is clearing the history"});
                break;
            case "turn.settled":
                if (event.data.error !== undefined) trace.events.push({kind: "error", at_ms: at(event), message: event.data.error.message});
                trace.events.push({kind: "finish", at_ms: at(event), outcome: event.data.outcome});
                break;
            default:
                break;
        }
    }
    return trace;
}

function add(total: number | null, value: number | undefined): number | null {
    return value === undefined || Number.isNaN(value) ? total : (total ?? 0) + value;
}

function preview(value: unknown, max: number): string {
    const text = typeof value === "string" ? value : (JSON.stringify(value) ?? "");
    return text.length <= max ? text : `${text.slice(0, max)}…`;
}
