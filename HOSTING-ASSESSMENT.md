# Hosting Assessment: HostAfrica Web_Basic vs. Amplus Connect

## The question

Can the `amplus-connect` codebase run on the HostAfrica "Web_Basic" shared
hosting plan already paid for (`amplusconstructionsolutions.com`, DirectAdmin
panel, 40GB disk, 100 email accounts, 50 databases)?

## Short answer

**No — not as it's currently built, and not with configuration changes alone.**
This isn't a case of "tweak a setting and it fits." The app and the hosting
plan are two different categories of product: one is a server-executed
application, the other is classic PHP/MySQL shared hosting with no application
runtime. Forcing a fit would mean removing most of what makes this an
e-commerce and admin platform rather than a brochure site.

The plan isn't wasted, though — see [What HostAfrica is still good for](#what-hostafrica-is-still-good-for-here).

## What this codebase actually is

From `package.json`, `vite.config.ts`, and the route/lib structure:

- **TanStack Start** (React 19) — a full-stack SSR framework, not a static
  site generator. Every page can run server code as part of rendering.
- Built via **Nitro** with the **`cloudflare-module`** preset
  ([vite.config.ts:67-69](vite.config.ts#L67-L69)) — the production build is a
  Cloudflare Workers module (a V8-isolate bundle), a different runtime shape
  from a traditional Apache/PHP process or even a plain Node.js server.
- Real server-side logic that must run per-request, not just be served as
  files:
  - [src/routes/api/public/pesapal/ipn.ts](src/routes/api/public/pesapal/ipn.ts) —
    the Pesapal payment webhook (IPN). Pesapal calls this URL directly after a
    payment; it must be a live, always-reachable server endpoint.
  - [src/lib/admin.functions.ts](src/lib/admin.functions.ts) — server
    functions (`createServerFn`) for staff role management, gated by
    `requireSupabaseAuth` and a super-admin check, using the Supabase
    **service role** key.
  - [src/integrations/supabase/cron-auth.ts](src/integrations/supabase/cron-auth.ts) —
    bearer-token-authenticated scheduled/cron routes, using `node:crypto`
    timing-safe comparison.
  - `src/lib/reconcile.server.ts` — server-side payment reconciliation,
    called from the IPN handler.
- **Secrets that must never reach the browser**: `SUPABASE_SERVICE_ROLE_KEY`,
  `PESAPAL_CONSUMER_KEY` / `PESAPAL_CONSUMER_SECRET`, `CRON_SECRET`. These are
  read via `process.env` inside server-only modules — this only works if
  there's a real server process holding them.
- **Data layer is Supabase** (hosted Postgres, Auth, Row-Level Security),
  managed via `supabase/migrations/`. It is not MySQL/MariaDB.

In short: corporate site + product catalog + cart/checkout + Pesapal
(M-Pesa/card) payments + customer accounts + loyalty rewards + a staff admin
portal, all backed by server code and a hosted Postgres database.

## What HostAfrica Web_Basic actually is

From the panel screenshot: DirectAdmin control panel, WordPress
Management, Site Builder, File Manager, "Database Management" (MySQL-style),
Email Accounts (100), FTP (1), DNS Management, SSL. This is the standard
shape of **PHP + MySQL shared hosting**. There's no Node.js runtime manager,
no SSH/shell access, and no indication of a way to run a persistent
server process or edge-worker runtime in the panel.

This is a perfectly good plan for what it's designed for: WordPress sites,
static HTML sites, or PHP applications (e.g. a classic PHP+MySQL CMS or
store). It is not designed to execute a Node.js/edge-runtime SSR application.

## Where it falls short, specifically

| Requirement | Amplus Connect needs | Web_Basic provides |
|---|---|---|
| Runtime | Node.js/V8-isolate server executing on every request | PHP interpreter behind Apache/LiteSpeed (no general JS runtime) |
| Build output | Cloudflare Workers module (`cloudflare-module` preset) | Static files or PHP scripts only |
| Payment webhook (Pesapal IPN) | Live server endpoint that runs code on each callback | No way to execute arbitrary server code |
| Secrets (service role key, Pesapal secret, cron secret) | Held server-side, injected as process env vars | No app process to hold them |
| Database | Supabase-hosted Postgres + Auth + RLS | MySQL/MariaDB databases (different engine, unused by this app) |
| Deploy process | `npm run build` + deploy a Workers bundle | FTP/File Manager upload of static/PHP files |
| Admin portal, cart, checkout, accounts | Server-rendered, authenticated, dynamic per request | Would need to be entirely static — not possible for these features |

Even *if* HostAfrica enabled a Node.js Selector on a higher tier, you'd still
need to: switch the Nitro preset from `cloudflare-module` to `node-server`,
get SSH/shell access to run `npm install && npm run build`, and keep a
long-running Node process alive behind their web server — none of which a
basic DirectAdmin shared plan is built to do.

## Could we strip it down to fit?

Only by removing the features that make this an actual store/admin platform:
no cart, no checkout, no Pesapal payments, no customer accounts, no loyalty
programme, no admin portal — i.e., a static marketing brochure only. That
defeats the purpose of what's been built. **Not recommended.**

## Recommended approach

1. **Deploy the app where it's already built to run: Cloudflare.**
   The `cloudflare-module` Nitro preset means this is a near-zero-config
   deploy to **Cloudflare Pages/Workers** (Cloudflare's free tier comfortably
   covers a site like this). This matches the comment already in
   [vite.config.ts:67-69](vite.config.ts#L67-L69) — Cloudflare was the
   intended target from the start, not an afterthought.
2. **Keep Supabase as the backend.** It's deeply integrated (Auth, RLS
   policies, migrations, service-role admin operations) — migrating off it to
   fit MySQL-based shared hosting would be a ground-up rewrite of auth,
   authorization, and every query in the app, for a plan that still can't run
   the server code. Not worth it.
3. **Point the domain at Cloudflare.** Since HostAfrica also manages DNS for
   `amplusconstructionsolutions.com`, either:
   - Move the domain's nameservers to Cloudflare (simplest; Cloudflare's free
     plan supports this and it's the standard path for Workers custom
     domains), or
   - Keep DNS at HostAfrica and add a CNAME/A record pointing at the
     Cloudflare deployment, if HostAfrica's DNS panel allows the record type
     Cloudflare requires for custom domains.
4. **Repurpose the paid Web_Basic plan** for what it's actually good at (see
   below) instead of trying to force the app onto it.

## What HostAfrica is still good for here

- **Email accounts** — 2/100 already provisioned; keep using these for
  company email (`@amplusconstructionsolutions.com`) regardless of where the
  website itself is hosted.
- **DNS management** — useful if you keep the zone there and just add records
  pointing at Cloudflare/wherever the app deploys.
- **A holding/parking page** — if there's a gap before the real deploy is
  live, a static "coming soon" page could sit on Web_Basic temporarily.
- **Backup/secondary domain use** — e.g. hosting a simple static brochure for
  a different, unrelated small site if one is ever needed.

It doesn't need to be canceled — it's just not the place for this
application.

## Open questions worth confirming with HostAfrica support

- Does this specific Web_Basic plan include a Node.js Selector or SSH access?
  (The panel screenshot doesn't show one, but worth a direct confirmation
  before ruling it out entirely.)
- Can DNS be managed at HostAfrica while the site itself is served from
  Cloudflare, or is a full nameserver migration required?
