# Amplus Connect

A custom-built digital platform for Amplus Construction Solutions: a corporate
site (services, projects, insights) plus an online store for construction
materials, with M-Pesa and card payments via Pesapal, customer accounts, a
loyalty rewards programme, and a staff admin portal.

## Stack

- [TanStack Start](https://tanstack.com/start) + [TanStack Router](https://tanstack.com/router) on React 19
- Tailwind CSS v4 + shadcn/Radix UI components
- [Supabase](https://supabase.com) (Postgres, Auth, RLS) as the backend
- [Pesapal](https://developer.pesapal.com) API 3.0 for M-Pesa/card checkout
- Deploys as a Cloudflare Worker (via [Nitro](https://nitro.build)'s `cloudflare-module` preset)

## Development

Requires Node.js and npm.

```sh
npm install
cp .env.example .env   # fill in the required values, see below
npm run dev
```

The dev server runs at `http://localhost:8080`.

### Environment variables

See [.env.example](.env.example) for the full list. At minimum you need:

- `SUPABASE_URL` / `VITE_SUPABASE_URL` and the matching publishable key
- `SUPABASE_SERVICE_ROLE_KEY` — server-only, used by checkout, payment
  reconciliation, the Pesapal IPN webhook, and admin role management
- `PESAPAL_CONSUMER_KEY` / `PESAPAL_CONSUMER_SECRET` for real payments
  (checkout still works without them, but skips the Pesapal redirect)

### Database

The Supabase schema, RLS policies and seed data live in
[supabase/migrations/](supabase/migrations/). See
[supabase/full_setup.sql](supabase/full_setup.sql) for a single consolidated
script to run against a fresh project.

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build (targets Cloudflare)
- `npm run build:dev` — development-mode build, for debugging a build issue
- `npm run preview` — preview a production build locally
- `npm run lint` — ESLint
- `npm run format` — Prettier
