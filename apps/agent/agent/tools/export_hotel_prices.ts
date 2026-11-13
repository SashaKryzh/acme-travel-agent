import {hotelOffers, nights, type HotelOffer} from "@acme/travel";
import {defineTool} from "eve/tools";
import {z} from "zod";

import {filters, json, ratesRequest, searchFields, stayFrom, travel} from "../lib/travel";

const COLUMNS = [
    "fetched_at", "place", "hotel_id", "name", "city", "address", "stars", "rating", "review_count", "checkin", "checkout", "nights",
    "adults", "children", "currency", "total_price", "price_per_night", "room_name", "board", "refundable", "latitude", "longitude"
] as const;

/** Hotel prices for one place and stay, written as CSV rows in the sandbox so Python can work on many of them. */
export default defineTool({
    description:
        "Fetch up to 200 hotel prices for one place and stay and save them as CSV rows in the sandbox, without showing anything. Use it for price research, as the research-prices skill says: call it once per place and date range, appending to one file, then analyse the file with Python in bash.",
    inputSchema: z.object({
        place: z.string().min(1).describe("City, neighbourhood or landmark, for example Krakow or Kazimierz"),
        ...searchFields,
        limit: z.number().int().min(1).max(200).describe("How many hotels to fetch, up to 200"),
        file: z.string().regex(/^[a-z0-9_-]{1,60}$/).describe("CSV file name without extension, for example krakow_december; saved as data/<file>.csv"),
        append: z.boolean().describe("True to add rows to the file when it exists, false to replace it")
    }),
    label: {start: ({place, checkin}) => `Collecting prices in ${place} from ${checkin}`},
    async execute(input, ctx) {
        const trip = travel(ctx);
        const stay = stayFrom(input, trip);
        const [place] = await trip.nuitee().searchPlaces(input.place, trip.abortSignal);
        if (place === undefined) throw new Error("Could not resolve the place");
        const rates = await trip.nuitee().searchRates(
            {
                ...ratesRequest(stay, input.limit, 1),
                ...filters(input),
                ...(place.location === undefined
                    ? {placeId: place.placeId}
                    : {latitude: place.location.latitude, longitude: place.location.longitude, radius: 10_000})
            },
            trip.abortSignal
        );
        const hotels = hotelOffers(rates, stay.checkin, stay.checkout).slice(0, input.limit);
        const stayNights = nights(stay.checkin, stay.checkout);
        const fetchedAt = new Date().toISOString();
        const rows = hotels.map((hotel) => row(hotel, input.place, fetchedAt, stayNights, stay.adults, stay.children));

        const sandbox = await ctx.getSandbox();
        const target = `data/${input.file}.csv`;
        const exists = (await sandbox.run({command: `test -f ${target}`})).exitCode === 0;
        await sandbox.run({command: "mkdir -p data"});
        if (input.append && exists) {
            const temp = `data/.${input.file}.${Date.now()}.csv`;
            await sandbox.writeTextFile({path: temp, content: rows.map(csvLine).join("\n") + "\n"});
            const result = await sandbox.run({command: `cat ${temp} >> ${target} && rm ${temp}`});
            if (result.exitCode !== 0) throw new Error(result.stderr);
        } else {
            await sandbox.writeTextFile({path: target, content: [csvLine([...COLUMNS]), ...rows.map(csvLine)].join("\n") + "\n"});
        }
        const count = await sandbox.run({command: `tail -n +2 ${target} | wc -l`});
        return {
            file: sandbox.resolvePath(target),
            rows_added: rows.length,
            rows_in_file: Number(count.stdout.trim()) || rows.length,
            checkin: stay.checkin,
            checkout: stay.checkout,
            currency: stay.currency,
            columns: COLUMNS,
            preview: rows.slice(0, 3)
        };
    },
    toModelOutput: (output) => json(output)
});

function row(hotel: HotelOffer, place: string, fetchedAt: string, stayNights: number, adults: number, children: number[]): string[] {
    const values: Record<(typeof COLUMNS)[number], unknown> = {
        fetched_at: fetchedAt,
        place,
        hotel_id: hotel.hotel_id,
        name: hotel.name,
        city: hotel.city,
        address: hotel.address,
        stars: hotel.stars,
        rating: hotel.rating,
        review_count: hotel.review_count,
        checkin: hotel.checkin,
        checkout: hotel.checkout,
        nights: stayNights,
        adults,
        children: children.join(" "),
        currency: hotel.price_currency,
        total_price: hotel.price_amount,
        price_per_night: stayNights > 0 ? Math.round((hotel.price_amount / stayNights) * 100) / 100 : hotel.price_amount,
        room_name: hotel.room_name,
        board: hotel.board_name,
        refundable: hotel.refundable_tag,
        latitude: hotel.latitude,
        longitude: hotel.longitude
    };
    return COLUMNS.map((column) => (values[column] === undefined || values[column] === null ? "" : String(values[column])));
}

function csvLine(values: readonly string[]): string {
    return values.map((value) => (/[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value)).join(",");
}
