import {localDate, type Account} from "@acme/travel";

/**
 * The context every turn carries after the user's message: when it was sent, then <now>, <location>, <account>,
 * <traveller_profile> and <plans>. Saved preferences and trips don't exist yet, so the last two are empty.
 */
export function turnContext(now: Date, account: Account): string {
    const zone = account.time_zone || null;
    const [first, ...rest] = account.name.trim().split(/\s+/);
    const blocks = [
        block("now", {at: now.toISOString(), timezone: zone, date: zone === null ? null : localDate(now, zone), time_format: "24h"}),
        block("location", {
            city_name: account.home_city || null,
            country_code: account.country_code || null,
            currency: account.currency || null
        }),
        block("account", {
            first_name: first || null,
            last_name: rest.length > 0 ? rest.join(" ") : null,
            email: account.email || null,
            language: account.language || null
        }),
        `<traveller_profile>\n{}\n</traveller_profile>`,
        `<plans>\n[]\n</plans>`
    ].join("\n\n");
    const sentAt = `${localDate(now, zone ?? "UTC")} ${localTime(now, zone ?? "UTC")}`;
    return `The user's latest message was sent on ${sentAt}.\n\n${blocks}`;
}

function block(name: string, value: unknown): string {
    return `<${name}>\n${JSON.stringify(value)}\n</${name}>`;
}

function localTime(date: Date, zone: string): string {
    return new Intl.DateTimeFormat("en-GB", {timeZone: zone, hour: "2-digit", minute: "2-digit", hour12: false}).format(date);
}
