export function money(amount: number, currency: string): string {
    try {
        return new Intl.NumberFormat("en-GB", {style: "currency", currency, maximumFractionDigits: 0}).format(amount);
    } catch {
        return `${Math.round(amount)} ${currency}`;
    }
}

export function shortDate(date: string): string {
    const value = new Date(`${date}T00:00:00`);
    return Number.isNaN(value.getTime())
        ? date
        : value.toLocaleDateString("en-GB", {weekday: "short", day: "numeric", month: "short"});
}

export function dateRange(start: string | undefined, end: string | undefined): string {
    if (start === undefined) {
        return "Dates not set";
    }
    return end === undefined ? shortDate(start) : `${shortDate(start)} – ${shortDate(end)}`;
}

export function guests(adults: number, children: number[]): string {
    const parts = [`${adults} adult${adults === 1 ? "" : "s"}`];
    if (children.length > 0) {
        parts.push(`${children.length} child${children.length === 1 ? "" : "ren"}`);
    }
    return parts.join(", ");
}

export function seconds(ms: number): string {
    return `${(ms / 1000).toFixed(1)}s`;
}

export function tokens(count: number | null): string {
    if (count === null) {
        return "?";
    }
    return count >= 1000 ? `${(count / 1000).toFixed(1)}k` : String(count);
}
