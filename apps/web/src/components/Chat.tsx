"use client";

import type {BookingResult, BookingWidget, HotelCard} from "@acme/travel";
import type {SessionStreamEvent} from "eve/client";
import {useEveAgent, type EveMessage, type Interaction} from "eve/react";
import {ArrowUp, Brain, Loader2, Plane, Plus, Search, Square} from "lucide-react";
import {useCallback, useEffect, useMemo, useRef, useState} from "react";

import {Button} from "@/components/ui/button";
import {Textarea} from "@/components/ui/textarea";
import {messageWithAction, visibleText, type UiAction} from "@/lib/actions";
import {saveChat} from "@/lib/history";
import {latestTurnTrace} from "@/lib/trace";

import {ChatHistory} from "./ChatHistory";
import {HotelSheet} from "./HotelSheet";
import {MessageView, type MessageActions} from "./MessageView";
import {TracePanel} from "./TracePanel";

const SUGGESTIONS = [
    "Find me a hotel in Le Marais, Paris for 4 to 6 December, two of us",
    "A romantic boutique hotel in Lisbon for a weekend in December",
    "What's on in Barcelona the week of 23 November, and where should I stay?",
    "Where did I go with ACME rides last week?"
];

/** One conversation with the agent. eve keeps its history; the URL holds the session id, so a reload resumes it. */
export function Chat({sessionId}: {sessionId?: string}) {
    const agent = useEveAgent({
        ...(sessionId === undefined ? {} : {initialSession: {sessionId, streamIndex: 0}, resume: true}),
        onSessionChange: (session) => {
            // The router would remount the page and cut the reply off, so the address changes without it.
            const path = session === null || session === undefined ? "/" : `/s/${encodeURIComponent(session.sessionId)}`;
            if (window.location.pathname !== path) History.prototype.replaceState.call(window.history, window.history.state, "", path);
        }
    });
    const [input, setInput] = useState("");
    const [openHotel, setOpenHotel] = useState<HotelCard | null>(null);
    const bottom = useRef<HTMLDivElement>(null);
    const busy = agent.status === "busy";
    const resuming = agent.status === "resuming";
    const trace = useMemo(() => latestTurnTrace(agent.events), [agent.events]);

    useEffect(() => {
        bottom.current?.scrollIntoView({behavior: "smooth", block: "end"});
    }, [agent.messages, agent.status]);

    const send = useCallback(
        (text: string, action?: UiAction) => {
            // While the agent works, a message steers its turn: it reads it at the next step, and background tasks keep going.
            if (resuming || text.trim().length === 0) return;
            void agent.send(messageWithAction(text.trim(), action)).catch(() => undefined);
        },
        [agent, resuming]
    );

    const actions: MessageActions = useMemo(() => {
        const {widgets, booked, awaitingPay} = bookingState(agent.messages);
        return {
            busy: resuming,
            widgetState: (widget, callId) => {
                if (booked.has(widget.prebook_id)) return {state: "booked"};
                if (widgets.get(widget.prebook_id) !== callId) return {state: "replaced"};
                const approval = awaitingPay.get(widget.prebook_id);
                return approval === undefined ? {state: "waiting"} : {state: "pay", approval};
            },
            respond: (interactionId, optionId) => void agent.respond([{interactionId, optionId}]).catch(() => undefined),
            openHotel: setOpenHotel
        };
    }, [agent, busy, resuming]);

    const tasks = useMemo(() => runningTasks(agent.events), [agent.events]);
    const reactions = useMemo(() => reactionsByMessage(agent.messages), [agent.messages]);

    // Remember this chat in the browser's list once it has a first message.
    const sessionIdNow = agent.session?.sessionId;
    const firstText = agent.messages.find((message) => message.role === "user")?.parts.find((part) => part.type === "text");
    const title = firstText?.type === "text" ? visibleText(firstText.text).text.slice(0, 80) : undefined;
    useEffect(() => {
        if (sessionIdNow !== undefined && title !== undefined) saveChat({id: sessionIdNow, title, updatedAt: Date.now()});
    }, [sessionIdNow, title, agent.messages.length]);

    const submit = () => {
        send(input);
        setInput("");
    };

    return (
        <div className="flex h-full">
            <ChatHistory currentId={sessionIdNow} />
            <main className="flex min-w-0 flex-1 flex-col">
                <header className="flex items-center gap-2 border-b px-4 py-2.5">
                    <a href="/" className="flex items-center gap-2 text-sm font-semibold">
                        <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                            <Plane className="size-4" />
                        </span>
                        ACME Travel
                    </a>
                    <div className="ml-auto flex items-center gap-1">
                        <Button variant="ghost" size="sm" asChild>
                            <a href="/memory" target="_blank" rel="noopener">
                                <Brain /> Memory
                            </a>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                            <a href="/">
                                <Plus /> New chat
                            </a>
                        </Button>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto">
                    <div className="mx-auto max-w-3xl space-y-6 px-5 py-6">
                        {agent.messages.length === 0 && !resuming && (
                            <div className="pt-16">
                                <h1 className="text-2xl font-semibold tracking-tight">Where to next?</h1>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Hotels with prices and test booking, trip research, and your ACME rides, in one chat.
                                </p>
                                <div className="mt-6 grid gap-2 sm:grid-cols-2">
                                    {SUGGESTIONS.map((suggestion) => (
                                        <Button
                                            key={suggestion}
                                            variant="outline"
                                            onClick={() => send(suggestion)}
                                            className="h-auto justify-start p-3 text-left font-normal whitespace-normal"
                                        >
                                            {suggestion}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        )}
                        {agent.messages.map((message) => (
                            <MessageView key={message.id} message={message} actions={actions} reactions={reactions.get(message.id)} />
                        ))}
                        {(resuming || (busy && agent.messages.at(-1)?.role === "user")) && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Loader2 className="size-4 animate-spin" /> {resuming ? "Loading the conversation…" : "Thinking…"}
                            </div>
                        )}
                        {agent.error !== undefined && agent.error !== null && (
                            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive" data-testid="chat-error">
                                {agent.error.message}
                            </div>
                        )}
                        <div ref={bottom} />
                    </div>
                </div>

                {tasks.length > 0 && (
                    <div className="mx-auto flex w-full max-w-3xl items-center gap-2 px-6 pb-2 text-xs text-muted-foreground" data-testid="running-tasks">
                        <Search className="size-3.5 animate-pulse" />
                        {tasks.length === 1 ? "Researching in the background" : `${tasks.length} research tasks in the background`}. Keep chatting.
                    </div>
                )}
                <form
                    className="mx-auto w-full max-w-3xl px-5 pb-5"
                    onSubmit={(event) => {
                        event.preventDefault();
                        submit();
                    }}
                >
                    <div className="flex items-end gap-2 rounded-2xl border bg-card p-2 shadow-xs focus-within:ring-2 focus-within:ring-ring/30">
                        <Textarea
                            value={input}
                            onChange={(event) => setInput(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                                    event.preventDefault();
                                    submit();
                                }
                            }}
                            rows={1}
                            disabled={resuming}
                            placeholder="Ask about a trip, a hotel, a place…"
                            className="max-h-40 min-h-0 flex-1 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
                            data-testid="composer"
                        />
                        {busy && (
                            <Button type="button" size="icon" variant="secondary" onClick={() => void agent.cancel()} title="Stop everything, including background research">
                                <Square className="fill-current" />
                            </Button>
                        )}
                        {(!busy || input.trim().length > 0) && (
                            <Button type="submit" size="icon" disabled={input.trim().length === 0 || resuming} title="Send" data-testid="send">
                                <ArrowUp />
                            </Button>
                        )}
                    </div>
                </form>
            </main>

            <aside className="hidden flex-col border-l bg-muted/30 lg:flex lg:w-1/3 xl:w-1/4">
                <div className="border-b px-4 py-3 text-sm font-semibold">Run trace</div>
                <div className="flex-1 overflow-y-auto p-3">
                    <TracePanel trace={trace} running={busy} />
                </div>
            </aside>

            <HotelSheet
                sessionId={agent.session?.sessionId}
                card={openHotel}
                busy={resuming}
                onClose={() => setOpenHotel(null)}
                onAction={(text, action) => {
                    setOpenHotel(null);
                    send(text, action);
                }}
            />
        </div>
    );
}

/** Tasks, such as hotel research, that started and haven't ended. */
function runningTasks(events: readonly SessionStreamEvent[]): string[] {
    const running = new Map<string, string>();
    for (const event of events) {
        const data = event.data as {taskId?: string; name?: string} | undefined;
        if (data?.taskId === undefined) continue;
        if (event.type === "task.started") running.set(data.taskId, data.name ?? "task");
        if (event.type === "task.ended") running.delete(data.taskId);
    }
    return [...running.values()];
}

/** The emoji the agent reacted with, on the user message each react call followed. */
function reactionsByMessage(messages: readonly EveMessage[]): Map<string, string[]> {
    const reactions = new Map<string, string[]>();
    let lastUser: string | undefined;
    for (const message of messages) {
        if (message.role === "user") {
            lastUser = message.id;
            continue;
        }
        for (const part of message.parts) {
            if (part.type !== "tool" || part.name !== "react" || lastUser === undefined) continue;
            const emoji = (part.input as {emoji?: string} | undefined)?.emoji;
            if (emoji === undefined) continue;
            const list = reactions.get(lastUser) ?? [];
            if (!list.includes(emoji)) list.push(emoji);
            reactions.set(lastUser, list);
        }
    }
    return reactions;
}

/** For each prebook: the call that showed its latest widget, whether book went through, and a book call waiting for Pay. */
function bookingState(messages: readonly EveMessage[]) {
    const widgets = new Map<string, string>();
    const booked = new Set<string>();
    const awaitingPay = new Map<string, Interaction>();
    for (const message of messages) {
        for (const part of message.parts) {
            if (part.type !== "tool") continue;
            if (part.name === "book" && part.interaction?.status === "open" && part.interaction.request.kind === "approval") {
                awaitingPay.set((part.input as {prebook_id: string}).prebook_id, part.interaction);
            }
            if (part.state !== "completed" || part.output === undefined) continue;
            if (part.name === "prebook" || part.name === "update_booking_widget") widgets.set((part.output as BookingWidget).prebook_id, part.callId);
            if (part.name === "book" && (part.output as BookingResult).status === "booked") booked.add((part.output as BookingResult).prebook_id);
        }
    }
    return {widgets, booked, awaitingPay};
}
