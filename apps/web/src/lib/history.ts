// This browser's chats. eve keeps each conversation on the server; the browser only remembers which sessions it started.

export interface ChatEntry {
    id: string;
    title: string;
    updatedAt: number;
}

const KEY = "acme-travel:chats";
const EVENT = "acme-travel:chats-changed";

export function loadChats(): ChatEntry[] {
    try {
        const chats = JSON.parse(localStorage.getItem(KEY) ?? "[]") as ChatEntry[];
        return Array.isArray(chats) ? chats.sort((a, b) => b.updatedAt - a.updatedAt) : [];
    } catch {
        return [];
    }
}

export function saveChat(entry: ChatEntry): void {
    try {
        const chats = loadChats().filter((chat) => chat.id !== entry.id);
        localStorage.setItem(KEY, JSON.stringify([entry, ...chats].slice(0, 100)));
        window.dispatchEvent(new Event(EVENT));
    } catch {
        // Storage can be unavailable, such as in a private window; the chat still works.
    }
}

export function onChatsChanged(listener: () => void): () => void {
    const onStorage = (event: StorageEvent) => event.key === KEY && listener();
    window.addEventListener(EVENT, listener);
    window.addEventListener("storage", onStorage);
    return () => {
        window.removeEventListener(EVENT, listener);
        window.removeEventListener("storage", onStorage);
    };
}
