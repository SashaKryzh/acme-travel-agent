"use client";

import type {BookingResult, BookingWidget, HotelCard, HotelGroup, WebSource} from "@acme/travel";
import type {EveMessage, EveMessagePart, EveToolPart} from "eve/react";
import {AlertTriangle, Brain, Check, ChevronRight, Globe, Loader2, MousePointerClick} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import {Collapsible, CollapsibleContent, CollapsibleTrigger} from "@/components/ui/collapsible";
import {visibleText} from "@/lib/actions";

import {BookingResultCard, BookingWidgetCard, type WidgetState} from "./cards/BookingCards";
import {HotelGroupCard} from "./cards/HotelGroupCard";

export interface MessageActions {
    busy: boolean;
    widgetState: (widget: BookingWidget, callId: string) => WidgetState;
    pay: (widget: BookingWidget) => void;
    openHotel: (hotel: HotelCard) => void;
}

export function MessageView({message, actions}: {message: EveMessage; actions: MessageActions}) {
    if (message.role === "user") return <UserMessage message={message} />;
    const sources = collectSources(message.parts);
    const replaced = replacedHotelGroups(message.parts);
    return (
        <div className="space-y-1" data-testid="assistant-message">
            {message.parts.map((part, index) =>
                part.type === "tool" && replaced.has(part.callId) ? null : (
                    <AssistantPart key={("id" in part && part.id) || ("callId" in part && part.callId) || index} part={part} actions={actions} />
                )
            )}
            {sources.length > 0 && <Sources sources={sources} />}
        </div>
    );
}

function UserMessage({message}: {message: EveMessage}) {
    const text = message.parts.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("\n");
    const shown = visibleText(text);
    return (
        <div className="flex justify-end" data-testid="user-message">
            <div className="max-w-[80%] rounded-2xl rounded-br-md bg-primary px-4 py-2 text-sm whitespace-pre-wrap text-primary-foreground">
                {shown.action && <MousePointerClick className="mr-1.5 inline size-3.5 opacity-60" />}
                {shown.text}
            </div>
        </div>
    );
}

function AssistantPart({part, actions}: {part: EveMessagePart; actions: MessageActions}) {
    switch (part.type) {
        case "text":
            return (
                <div className="prose-chat text-[15px] leading-relaxed">
                    <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                            a: ({href, children}) => (
                                <a href={href} target="_blank" rel="noreferrer">
                                    {children}
                                </a>
                            )
                        }}
                    >
                        {part.text}
                    </ReactMarkdown>
                </div>
            );
        case "reasoning":
            return part.text.trim().length === 0 ? null : (
                <Collapsible className="text-xs text-muted-foreground">
                    <CollapsibleTrigger className="flex items-center gap-1 hover:text-foreground">
                        <Brain className="size-3.5" /> Thinking
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-1 border-l-2 pl-3 whitespace-pre-wrap">{part.text}</CollapsibleContent>
                </Collapsible>
            );
        case "tool":
            return part.kind === "control" ? null : <ToolPart part={part} actions={actions} />;
        default:
            return null;
    }
}

function ToolPart({part, actions}: {part: EveToolPart; actions: MessageActions}) {
    if (part.state === "failed" || part.state === "rejected" || part.state === "cancelled") {
        return <ToolActivity part={part} status="error" detail={part.error?.message ?? part.state} />;
    }
    if (part.state !== "completed" || part.output === undefined) return <ToolActivity part={part} status="running" />;
    switch (part.name) {
        case "show_hotels":
            return <HotelGroupCard group={part.output as HotelGroup} onOpen={actions.openHotel} />;
        case "prebook":
        case "update_booking_widget": {
            const widget = part.output as BookingWidget;
            return <BookingWidgetCard widget={widget} state={actions.widgetState(widget, part.callId)} disabled={actions.busy} onPay={actions.pay} />;
        }
        case "book":
            return <BookingResultCard result={part.output as BookingResult} kind="book" />;
        case "cancel_booking":
            return <BookingResultCard result={part.output as BookingResult} kind="cancel" />;
        default:
            return <ToolActivity part={part} status="done" />;
    }
}

function ToolActivity({part, status, detail}: {part: EveToolPart; status: "running" | "done" | "error"; detail?: string}) {
    const input = (part.input ?? {}) as Record<string, unknown>;
    return (
        <Collapsible className="group text-xs text-muted-foreground" data-testid="tool-activity" data-tool={part.name}>
            <CollapsibleTrigger className="flex max-w-full min-w-0 items-center gap-1.5 py-0.5 text-left hover:text-foreground">
                {status === "running" && <Loader2 className="size-3.5 shrink-0 animate-spin" />}
                {status === "done" && <Check className="size-3.5 shrink-0" />}
                {status === "error" && <AlertTriangle className="size-3.5 shrink-0 text-amber-600" />}
                <span className="truncate">{activityLabel(part.name, input)}</span>
                <ChevronRight className="size-3 shrink-0 transition group-data-[state=open]:rotate-90" />
            </CollapsibleTrigger>
            <CollapsibleContent>
                <pre className="mt-1 max-h-48 overflow-auto rounded-lg bg-muted p-2 font-mono text-[11px]">
                    {part.name}
                    {"\n"}
                    {JSON.stringify(part.input ?? part.inputText, null, 2)}
                    {detail !== undefined && `\n\nError: ${detail}`}
                </pre>
            </CollapsibleContent>
        </Collapsible>
    );
}

function activityLabel(name: string, input: Record<string, unknown>): string {
    const text = (key: string) => (typeof input[key] === "string" ? (input[key] as string) : "");
    switch (name) {
        case "search_hotels_by_location":
            return `Searching hotels in ${text("place")}`;
        case "search_hotels_by_query":
            return `Searching "${text("query")}"`;
        case "get_hotel_details":
            return "Reading hotel details and rooms";
        case "get_hotel_reviews":
            return "Reading guest reviews";
        case "web_search":
            return `Researching: ${text("query")}`;
        case "prebook":
            return "Checking the final price";
        case "update_booking_widget":
            return "Updating the guest details";
        case "book":
            return "Booking";
        case "cancel_booking":
            return "Cancelling the booking";
        case "get_booking":
        case "list_bookings":
        case "get_prebook":
            return "Looking up bookings";
        case "get_ride_history":
            return "Checking your ACME rides";
        case "skill":
            return "Getting ready";
        case "show_hotels":
            return "Preparing hotel cards";
        default:
            return name;
    }
}

/** show_hotels again for the same stay replaces its cards, so only the latest group per stay in a reply is shown. */
function replacedHotelGroups(parts: readonly EveMessagePart[]): Set<string> {
    const latest = new Map<string, string>();
    const replaced = new Set<string>();
    for (const part of parts) {
        if (part.type !== "tool" || part.name !== "show_hotels" || part.state !== "completed" || part.output === undefined) continue;
        const {stay} = part.output as HotelGroup;
        const key = [stay.checkin, stay.checkout, stay.adults, stay.children.join("."), stay.currency, stay.guest_nationality].join("|");
        const previous = latest.get(key);
        if (previous !== undefined) replaced.add(previous);
        latest.set(key, part.callId);
    }
    return replaced;
}

function collectSources(parts: readonly EveMessagePart[]): WebSource[] {
    const sources = new Map<string, WebSource>();
    for (const part of parts) {
        if (part.type !== "tool" || part.name !== "web_search" || part.state !== "completed") continue;
        for (const source of ((part.output as {sources?: WebSource[]} | undefined)?.sources ?? []).slice(0, 6)) sources.set(source.url, source);
    }
    return [...sources.values()];
}

function Sources({sources}: {sources: WebSource[]}) {
    return (
        <div className="flex flex-wrap gap-1.5 pt-1" data-testid="sources">
            {sources.map((source) => (
                <a
                    key={source.url}
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex max-w-full items-center gap-1 rounded-full border bg-card px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
                >
                    <Globe className="size-3 shrink-0" />
                    <span className="truncate">{source.title ?? new URL(source.url).hostname}</span>
                </a>
            ))}
        </div>
    );
}
