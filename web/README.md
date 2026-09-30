# RestaurantGo — Marketing Site & Super-Admin

React/Vite app serving two audiences from one deployment:

- **Public marketing site** (`/`, `/restaurants`, `/restaurants/:slug`, `/contact`, `/register`) —
  RestaurantGo's own company site, the restaurant directory, and self-service tenant signup.
- **Super-admin panel** (`/admin/*`) — the platform team's own operations console: tenants,
  payments, subscription plans, coupons, internal staff + payroll, advertisements, contact inbox.
  Role-gated by Spatie permissions on the API side, not just hidden UI.

This is deliberately one app rather than a third separate one — see
[`../restaurant_saas_plan.md`](../restaurant_saas_plan.md) for the reasoning. For the tenant-facing
admin panel and each restaurant's own public menu/blog, see [`../dashboard`](../dashboard).

## Stack

React 19, TypeScript, Vite, Tailwind CSS, Zustand (auth state), react-router-dom, Vitest +
Testing Library.

## Local setup

```sh
npm install
cp .env.example .env   # defaults point at the API on localhost:8000
npm run dev             # http://localhost:5174
```

Requires the [`../api`](../api) backend running (`php artisan serve`). Super-admin login
credentials for local demo data are in [`../DEV_CREDENTIALS.md`](../DEV_CREDENTIALS.md).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Type-check (`tsc -b`) then production build to `dist/` |
| `npm run lint` | oxlint |
| `npm test` | Vitest (jsdom) |
| `npm run preview` | Serve the production build locally |

CI (`.github/workflows/ci.yml`) runs lint, type-check, tests and build on every push/PR.

## Environment variables

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Base URL of the Laravel API (e.g. `http://localhost:8000/api`) |
| `VITE_RESTAURANT_SITE_URL` | Origin of the `dashboard` app, where each restaurant's own `/p/:slug` pages are served — used to link out to them |
| `VITE_SENTRY_DSN` | Optional; frontend error monitoring is a no-op until this is set |

## Docker

`docker compose up --build` from the repo root builds and serves this app via nginx on
`localhost:5174` alongside the API, dashboard, and database — see
[`../docker-compose.yml`](../docker-compose.yml).
