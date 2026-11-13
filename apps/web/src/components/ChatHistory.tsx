"use client";

import {MessageSquare} from "lucide-react";
import {useEffect, useState} from "react";

import {loadChats, onChatsChanged, type ChatEntry} from "@/lib/history";

/** The chats started in this browser, newest first. Opening one resumes it from eve. */
export function ChatHistory({currentId}: {currentId?: string}) {
    const [chats, setChats] = useState<ChatEntry[]>([]);

    useEffect(() => {
        setChats(loadChats());
        return onChatsChanged(() => setChats(loadChats()));
    }, []);

    return (
        <aside className="hidden w-60 shrink-0 flex-col border-r bg-muted/30 md:flex">
            <div className="border-b px-4 py-3 text-sm font-semibold">Chats</div>
            <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
                {chats.length === 0 && <p className="px-2 py-1 text-xs text-muted-foreground">Your chats in this browser show here.</p>}
                {chats.map((chat) => (
                    <a
                        key={chat.id}
                        href={`/s/${encodeURIComponent(chat.id)}`}
                        className={`flex items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted ${chat.id === currentId ? "bg-muted font-medium" : ""}`}
                    >
                        <MessageSquare className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                        <span className="min-w-0">
                            <span className="line-clamp-2">{chat.title}</span>
                            <span className="text-xs text-muted-foreground">{new Date(chat.updatedAt).toLocaleString([], {dateStyle: "short", timeStyle: "short"})}</span>
                        </span>
                    </a>
                ))}
            </nav>
        </aside>
    );
}
