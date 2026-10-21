# LeadFinder

A lead-generation workspace that turns a small set of filters (industry, city, role, company size…) into properly formed **Google** and **Google Maps** search queries, and keeps everything you find in a built-in **lead CRM**.

No paid APIs, no scraping, no automation against Google or LinkedIn — LeadFinder only builds `google.com/search?q=…` and Maps deep-link URLs that open in a new tab, and stores the data **you** enter.

## Features

- **Search workspace** — pick filters once, generate every matching query from the template library, copy individually, save to history, or open up to 12 results at once.
- **65 built-in templates** across 9 categories (LinkedIn profiles, buying intent, startup founders, Google Maps discovery, communities, contact pages…), all editable/duplicable, plus a custom-query builder with live preview.
- **Lead CRM** — search, filter (status / country / industry / favorite / list), sort, paginate, bulk-update, organize into lists, import/export CSV, 409-duplicate detection with "save anyway".
- **Dashboard** — pipeline stats, by-country/industry breakdowns, recent searches & leads, favorite templates.
- **Search history** — every run is logged; star the useful ones, re-run or copy with one click.
- **Settings** — default country/industry/city, results per page, date range, company-size keyword toggle; applied automatically when the search page opens.
- Dark/light theme, fully responsive (mobile drawer navigation).

## Tech stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS v4 · Prisma 6 + SQLite · Zod · shadcn-style UI primitives (Radix) · Vitest

## Getting started

```bash
npm install

cp .env.example .env        # DATABASE_URL="file:./dev.db"

npm run db:setup            # prisma migrate dev — creates prisma/dev.db + applies migrations + seeds
npm run dev                 # http://localhost:3000
```

The first run seeds **65 built-in templates** and default settings (idempotent — it only seeds when the template table is empty, so your edits/deletions are never overwritten). To re-seed from scratch: delete `prisma/dev.db`, then `npm run db:setup`.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` / `start` | Production build / serve |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit tests (Vitest) |
| `npm run db:setup` | Create/migrate the SQLite DB and seed |
| `npm run db:seed` | Seed templates + settings only |
| `npm run db:studio` | Prisma Studio |

## How the query engine works

`src/lib/query-engine.ts` is pure and dependency-free:

1. **Templates** contain placeholders: `{industry} {city} {state} {country} {role} {keyword} {year}`.
2. Quoted placeholders (`"{role}"`, `"{keyword}"`) expand to Google OR-groups when several values are selected — e.g. `("Owner" OR "Founder")` — a single value stays unquoted.
3. Empty filters are removed cleanly: no dangling `""`, no orphaned `OR`/`AND`, no stray commas (`sanitizeQuery`).
4. `{year}` is resolved to the current year at generation time.
5. Optional appends: include keywords (`"cafe"` / `("cafe" OR "roastery")`), exclusions (`-"jobs"`), company-size phrases (`"11-50 employees"`) when the switch is on.
6. Maps templates (`"{industry} in {city}, {state}"`) drop empty segments **with their prepositions** so the phrase stays natural.
7. Results are URL-encoded into `https://www.google.com/search?q=…` (plus `&tbs=qdr:d|w|m|y` for date filters) or the Maps `search/?api=1&query=…` deep link.

Templates are filtered by category and by which *source* they target (Google, Google Maps, LinkedIn Profiles, Buying Intent, …); unusable queries (nothing left after substitution) are skipped.

## Data model (SQLite via Prisma)

- **Lead** — business/founder/contact fields, status pipeline (`New → Contacted → Qualified → Proposal → Won/Lost`), tags, favorite flag, many-to-many with **LeadList**.
- **SearchTemplate** — name, category, engine (google/maps), template text, sources, built-in vs custom, favorite.
- **SearchHistory** — every generated query you run or save, with filters snapshot + label.
- **Setting** — key/value UI defaults.

Database file lives at `prisma/dev.db` (both the Prisma CLI and the runtime resolve it there).

## API (all dynamic, JSON)

```
GET/POST          /api/leads            list/create (q, status, country, industry, favorite, listId, sort, order, page, pageSize)
GET/PUT/DELETE    /api/leads/:id        single lead (PUT accepts partial updates)
PATCH             /api/leads/bulk       setStatus | setFavorite | addToList | removeFromList | delete
POST              /api/leads/import     multipart CSV (file, skipDuplicates, listId)
GET               /api/leads/export     CSV download with the same filters
GET/POST          /api/lists            lists (+ /api/lists/:id PUT/DELETE)
GET/POST/DELETE   /api/searches         history (scope=all|saved on DELETE), ?limit=
PATCH/DELETE      /api/searches/:id     star/unstar, delete
POST              /api/searches/save    save up to 50 queries at once
GET/POST          /api/templates        list (favorite=true filter) / create
PUT/DELETE        /api/templates/:id    partial update (isFavorite…) / delete
GET               /api/stats            dashboard aggregates
GET/PUT           /api/settings         UI defaults
```

Errors are `{ "error": "…" }` with proper status codes (400 validation, 404 missing, 409 duplicate).

## Verification

```bash
npm run lint        # 0 errors
npm run typecheck   # 0 errors
npm test            # 62 unit tests (query engine + CSV round-trips)
npm run build       # production build

# end-to-end smoke test (35 checks against the live API + pages):
npm run build && npm run start -- -p 3111   # in one shell
node smoke.mjs                               # in another — self-cleaning
```

> `npm run lint` reports `react-hooks/set-state-in-effect` as a **warning** (downgraded in `eslint.config.mjs`): the rule flags the standard fetch-on-mount pattern (`useEffect(() => { void load() }, [])`) even when every `setState` runs after `await`.

## Compliance

LeadFinder performs no scraping and bypasses no access controls. Queries open public Google/Maps results in your browser; LinkedIn-related templates are just Google `site:` queries against public profiles. Verify prospects yourself and contact people only through permitted channels.
