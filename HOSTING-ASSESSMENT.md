# Hosting Assessment: HostAfrica Web_Basic + Node.js App

**Status (Oct 2026):** DirectAdmin **does** include Extra Features → **Setup Node.js App**. That is enough to run Amplus the same way Kalimoni runs `parish-api` — except Amplus’s Node process serves the **whole** store, not only `/api`.

Step-by-step deploy: **[HOST-AFRICA.md](HOST-AFRICA.md)**.

## Short answer

| Question | Answer |
|----------|--------|
| Can this app run on the paid Web_Basic plan? | **Yes**, using Setup Node.js App + Apache in front of Nitro `node-server`. |
| Can we FTP a static `dist/` into `public_html` like a brochure? | **No** — checkout, tickets, Gmail, webhooks, and admin need Node. |
| Do we use Host Africa MySQL? | **No** — Supabase stays the database. |
| What is Web_Basic still for besides Node? | Email (`@amplusconstructionsolutions.com`), SSL, DNS, cron, FTP. |

The older conclusion in this file (“PHP only, no Node”) was based on a panel screenshot that missed Extra Features. That is obsolete.

## Architecture (Kalimoni vs Amplus)

| | Kalimoni parish | Amplus Connect |
|--|-----------------|----------------|
| Public UI | Vite SPA in `public_html` | TanStack Start SSR from Node |
| Node | `parish-api` Express, `/api` only | Nitro `node-server`, entire domain |
| Startup | `parish-api/server.js` `listen(PORT)` | `hosting/hostafrica/server.mjs` → `.output/server/index.mjs` |
| Database | Supabase | Supabase |
| Build on the server | No | **No** — build on a PC, upload `.output` |

## What this codebase needs (and how Web_Basic meets it)

| Requirement | How |
|-------------|-----|
| Runtime | DirectAdmin Node.js App, Node 20+, `npm start` |
| Build output | `npm run build` → Nitro `node-server` (`.output/`) |
| Webhooks | Same Node process: `/api/public/pesapal/ipn`, `/api/public/paystack/webhook` |
| Secrets | `.env` in the application root or panel env vars |
| Database | Supabase (ignore the 50 MySQL slots) |
| Cron | DirectAdmin Cron Jobs → `/api/cron/order-reminders` |
| Email | Host Africa mailboxes + Gmail SMTP for transactional mail |

## Do not

- Install WordPress / Softaculous on this domain.
- Point the Node application root at `public_html` (source would be downloadable).
- Expect live Equity 247247 auto-confirm (not free).
- Commit `.env`.
