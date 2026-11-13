# ACME Travel Agent

A travel agent for the fictional ACME company, built with [eve](https://eve.dev) (Vercel's filesystem-first framework for durable agents) and a Next.js chat in [shadcn/ui](https://ui.shadcn.com).

The agent searches hotels, shows them as cards and on a map, opens a hotel page with every room, prebooks the one you pick into a booking widget with a Pay button, books it, checks and lists bookings, cancels with a refund, researches the trip on the web with sources, and reads your ACME ride history. A side panel traces each turn live: model calls, tokens and cache hits, tool calls with their input and output.

It runs out of the box on a mocked world, so you only need a model key.

![Hotel cards and the run trace](docs/screenshots/chat.png)

| Map view | Booking widget | Web research with sources |
| --- | --- | --- |
| ![Map](docs/screenshots/map.png) | ![Booking widget](docs/screenshots/widget.png) | ![Research](docs/screenshots/research.png) |

## Quick start

Node 24 and pnpm 10.12.1.

```bash
pnpm install
cp apps/agent/.env.example apps/agent/.env.local   # then set AI_GATEWAY_API_KEY
pnpm dev                                           # the agent on :3200 and the web app on :3000
```

Open http://localhost:3000. Try "Find me a hotel in Le Marais, Paris for 4 to 6 December, two of us", open a card, select a room, tap Pay, then ask it to cancel.

The repo is a pnpm workspace run with [Turborepo](https://turborepo.com). `pnpm dev`, `pnpm build` and `pnpm typecheck` run the task in every app and package. To run one app, filter it: `pnpm --filter @acme/agent dev` (eve on http://127.0.0.1:3200) or `pnpm --filter web dev` (Next.js on http://localhost:3000). `pnpm --filter @acme/agent info` shows what eve discovered: one system instruction and 15 tools.

## Environment

Each app has its own env file, as each would on Vercel. The agent's [apps/agent/.env.example](apps/agent/.env.example) holds everything below except `EVE_AGENT_URL`. The web app needs none: [apps/web/.env.example](apps/web/.env.example) only has `EVE_AGENT_URL`, for an agent that isn't on its default address.

| Variable | Default | What it does |
| --- | --- | --- |
| `AI_GATEWAY_API_KEY` | | [Vercel AI Gateway](https://vercel.com/docs/ai-gateway) key. eve routes gateway model ids with it |
| `AGENT_MODEL` | `anthropic/claude-sonnet-5.5` | The model. A gateway id, or a model name of the OpenAI-compatible server below |
| `OPENAI_COMPATIBLE_BASE_URL` | | Optional: any OpenAI-compatible Chat Completions server (OpenAI, OpenRouter, vLLM, Ollama, LiteLLM…) instead of the gateway |
| `OPENAI_COMPATIBLE_API_KEY` | | Its key |
| `AGENT_CONTEXT_WINDOW_TOKENS` | `200000` | That model's context window, so eve knows when to compact |
| `NUITEE_API_KEY` | | [LiteAPI](https://www.liteapi.travel) (by Nuitee) key for live hotels. A sandbox key (`sand_…`) books test stays for free |
| `EXA_API_KEY` | | [Exa](https://exa.ai) key for live web research |
| `ACME_DEMO` | | `1` forces demo mode, `0` forces live mode. Unset: demo unless both keys above are set |
| `ACME_USER_NAME`, `ACME_USER_EMAIL`, `ACME_HOME_CITY`, `ACME_COUNTRY_CODE`, `ACME_CURRENCY`, `ACME_LANGUAGE`, `ACME_TIME_ZONE` | Sam Rivera, sam.rivera@example.com, Tallinn, EE, EUR, en, Europe/Tallinn | The ACME account the agent works for |
| `EVE_AGENT_URL` | `http://127.0.0.1:3200` | Web app: where it proxies `/eve/v1/*` and `/acme/v1/*` to |

## Demo mode

Without both a LiteAPI and an Exa key, every tool runs on a mocked world (`packages/travel/fixtures/world.json`):

- **Hotels:** 298 hotels in Lisbon, Porto, Barcelona, Paris, Rome, London, Amsterdam, Berlin, Prague and Tallinn, recorded once from the LiteAPI sandbox (names, photos, rooms, reviews, coordinates), at fixed nightly prices with refundable and non-refundable rates. Search by city, by 39 neighbourhoods (Le Marais, Trastevere, Shoreditch, Kalamaja…) or by style.
- **Booking:** a fake supplier for prebook, book, status and cancel, with booking state that persists: cancelling a refundable booking refunds it in full, and a non-refundable one keeps the full price as the fee.
- **Web research:** 43 hand-written pages on events in November and December 2026, getting around, neighbourhoods and the weather in each city.

ACME rides are always mocked: a month of rides around Tallinn, generated from today's date. There is no real ACME.

Demo and live mode keep their data apart, in `data/demo/` and `data/live/` (gitignored): the offers each session has seen, the bookings and the fake supplier's state. Delete the folder to reset.

## Architecture

```text
apps/
├── agent/                       @acme/agent: the eve app, the only server
│   └── agent/
│       ├── agent.ts             model from the environment, eve's default tools off
│       ├── instructions.ts      the system prompt with its skill catalog and a note on the Pay button
│       ├── channels/eve.ts      eve's session API: localDev() auth, and the per-turn context
│       ├── channels/hotels.ts   GET /acme/v1/hotel-page, the hotel page a card opens
│       ├── tools/<name>.ts      the 15 tools, one file each
│       └── lib/
│           ├── travel.ts        what the tools share: schemas, stay rules, offer lookup, the JSON the model reads
│           ├── turnContext.ts   <now>, <location>, <account>, <traveller_profile>, <plans>
│           ├── model.ts         AI Gateway id, or an OpenAI-compatible server
│           ├── prompts/         the system prompt
│           └── skills/          find-a-stay, the playbook for searching and choosing a hotel
└── web/                         web: Next.js 16 + shadcn/ui, frontend only
packages/
└── travel/                      @acme/travel: LiteAPI and Exa clients, the JSON store, the demo world, the hotel page
turbo.json                       dev, build and typecheck across the workspace
```

**One server, one owner.** The agent is the only server and eve owns the history. The web app is a frontend: the browser talks to the agent with `useEveAgent` from `eve/react`, and Next.js rewrites `/eve/v1/*` (eve's session API) and `/acme/v1/*` (the hotel page route) to the agent, so they share an origin. The web app imports only types from `@acme/travel`, needs no secrets, and has no API routes. A conversation's URL is `/s/<sessionId>`, and reloading it replays the session from eve. The agent keeps the offers each session has seen and the bookings in `data/` at the repo root (gitignored).

**Turn context.** The channel's `onMessage` adds the turn context as eve `clientContext`: when the message was sent, then `<now>` (time, zone, local date, 24h clock), `<location>` (home city, country, currency), `<account>` (name, email, language), and empty `<traveller_profile>` and `<plans>`. It reaches every model call of the turn without being stored in the history. The prompt resolves relative dates against `<now>`, uses concrete dates, picks dates inside a loose timeframe, assumes a near-term weekend for a broad question, and asks only when the dates matter.

**Tools.** Each tool has a plain JSON schema that eve validates. It returns the data the UI renders (hotel cards, the booking widget, booking results) plus `model_output`, the compact JSON the model reads through `toModelOutput`. Offer ids the model sees are short aliases (`of_…`); the supplier's offer id stays in the store.

| Tool | What it does |
| --- | --- |
| `skill` | Loads `find-a-stay`, the playbook for searching and choosing a hotel |
| `search_hotels_by_location`, `search_hotels_by_query` | Rates by place (radius, hotel name) or by AI search, with filters: stars, review count, meal plans, refundable, accessible, sort |
| `show_hotels` | Hotel cards for up to 6 offers of one stay, with a map view |
| `get_hotel_details`, `get_hotel_reviews` | One hotel with up to 10 rates and its room types; guest reviews with sentiment |
| `prebook` | The final price, and the booking widget with a Pay button, prefilled from the ACME account |
| `update_booking_widget` | New holder or primary guest on the widget |
| `book` | Books with the holder and one primary guest, idempotent per prebook |
| `get_prebook`, `get_booking`, `list_bookings`, `cancel_booking` | Booking status, the user's bookings, cancellation with refund and fee |
| `get_ride_history` | The user's finished ACME rides between two dates |
| `web_search` | Exa's research agent: a short answer with its sources |

**Pay.** Tapping Pay sends a message whose visible text is "Pay", followed by a `[UI action]` line with the prebook id; the instructions tell the agent to call `book` then. Selecting a room on the hotel page works the same way. The chat shows only the visible text.

**Lockdown.** `defaultTools: false` turns off eve's shell, files, web fetch, its own web search and the root-copy `agent` tool, and `eve dev --no-default-extensions` keeps the self-modification extensions out. The travel tools are the whole surface.

## Limitations

- **Local only.** Both agent channels admit only `localDev()` callers: requests from this machine during `eve dev`. A deployment admits no one until it has real auth. **Follow-up:** add user auth to `apps/agent/agent/channels/` (your app's session, Clerk, Auth.js or another `AuthFn`, see eve's auth guide) and scope bookings and offers per user.
- **Not deployed yet.** On Vercel, each app would be its own project in this monorepo: `apps/agent` (deployed with `eve deploy`) and `apps/web` (Root Directory `apps/web`, with `EVE_AGENT_URL` set to the agent's URL). eve can also compose both into one project with `withEve` from `eve/vercel`. Neither has been tried here, and the agent's JSON files would need a database first, since a deployment's filesystem doesn't persist.
- **One account.** The account is fixed by env, and `list_bookings` lists every booking in the data folder.
- **Restarts.** After an `eve dev` restart, earlier sessions are dormant: they still replay, but a new message fails. Start a new chat, or restart with `eve dev --resume` to try to recover them.
- **No chat list.** Conversations live in eve; the app has no index of them. Keep the URL to come back to one.
- **No approvals or questions.** eve's approvals, questions and sign-ins have no renderer here. Nothing in this agent opens one.
- **Preview software.** eve 0.90 is a public preview with fast-moving APIs.

## Credits

Hotel data in demo mode was recorded from the LiteAPI sandbox; photos belong to their hotels. Maps use [OpenStreetMap](https://www.openstreetmap.org/copyright) tiles through Leaflet. The system prompt's persona section is adapted from published assistant prompts, as noted in its frontmatter.
