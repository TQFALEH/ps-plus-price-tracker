# PlayStation Plus Price Tracker

## 1) Chosen framework
**Next.js (React + TypeScript)**

Why this is the best fit:
- Performance: App Router, route-level code splitting, server-first data flows, and fast API routes in one runtime.
- Scalability: Clear separation of UI and backend route handlers with typed models.
- Developer experience: Single TypeScript stack (frontend + backend), fast iteration, and mature tooling.
- UI ecosystem: Tailwind + React Query + virtualization libraries provide a modern, high-performance dashboard quickly.
- Deployment speed: One deployable app (Vercel, Docker, or Node host) without separate frontend/backend projects.

## Official source policy
1. **Preferred**: This app fetches data from official PlayStation URLs (`playstation.com/<locale>/ps-plus/`) and parses structured JSON-LD if available.
2. **Primary extraction strategy**: Parse official embedded `data-product-info` SKU metadata from each locale page (contains full tier/duration prices and currency).
3. **Fallback**: Parse official tier selector JSON blocks and then JSON-LD if needed, with retries, caching, and logging.
3. Scraping is **backend only** (never frontend), with stale caching and request reduction.

## 2) Project structure

```txt
src/
  app/
    api/
      countries/
        [id]/route.ts
        route.ts
      prices/route.ts
      refresh/route.ts
    layout.tsx
    page.tsx
  components/
    country-form.tsx
    dashboard.tsx
    price-table.tsx
    providers.tsx
    theme-toggle.tsx
  lib/
    api-client.ts
    cache.ts
    db.ts
    logger.ts
    pricing-service.ts
    ps-plus-provider.ts
    rate-limit.ts
    retry.ts
    utils.ts
    validation.ts
  models/
    index.ts
  styles/
    globals.css
```

## 3) Complete frontend + backend
Implemented in files above:
- Frontend: dashboard, filters, sorting, search, virtualized table, dark/light mode, country add/delete, per-country/all refresh.
- Backend: REST APIs, SQLite persistence, zod validation, rate limiting, retry/backoff, logging, caching.

## 4) Data models/interfaces
`src/models/index.ts`
- `Country`
- `PriceRecord`
- `CountryInput`
- `RefreshResult`
- `Tier`, `DurationMonths`

## 5) Example pricing fetch/parser
`src/lib/ps-plus-provider.ts`
- Fetches official PlayStation region page.
- Extracts and decodes official `data-product-info` JSON from page attributes (preferred).
- Fallbacks to official embedded tier-selector JSON scripts and JSON-LD.
- Detects PS Plus tier and duration from structured text.
- Returns typed price entries.

`src/lib/country-discovery.ts`
- Discovers supported PS Plus locales from official `hreflang` alternate links.
- Normalizes locales to ISO country rows and syncs them into DB.

## 6) Caching implementation
- Server cache:
  - DB cache validity (`cache_expires_at`) with default TTL 6 hours.
  - In-memory source-page cache to reduce repetitive fetches.
- Client cache:
  - React Query stale-while-revalidate behavior (`staleTime`, background invalidation).

## 7) UI + CRUD + refresh
Implemented in `src/components/dashboard.tsx` + API routes:
- Add country modal/form
- Delete country action
- Refresh per country
- Refresh all (client progress and server bulk route)
- Search/filter/sort controls
- Automatic country discovery sync from official PlayStation locales on `/api/countries` and refresh-all flows.

## 8) Setup

### Install
```bash
npm install
```

### Environment
Create `.env` from `.env.example`:
```bash
cp .env.example .env
```

### Run
```bash
npm run dev
```
Open: `http://localhost:3000`

## API endpoints
- `GET /api/prices`
- `GET /api/prices?country=US`
- `POST /api/countries`
- `DELETE /api/countries/:id`
- `POST /api/refresh`
  - single: `{ "countryId": 1, "force": true }`
  - all: `{ "all": true, "force": true }`

## Notes
- If a locale page does not expose parseable structured price data, refresh returns a clear error for that country and logs details.
- You can set a specific official source URL per country in the add-country form to improve parsing reliability.
- The app auto-discovers official supported regions and inserts missing countries (deduped by ISO code).
