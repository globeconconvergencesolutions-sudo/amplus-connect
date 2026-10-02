# Host Africa (DirectAdmin) — Amplus Connect

This is the production path for **amplusconstructionsolutions.com** on Host Africa **Web_Basic**. It is the same hosting shape as Kalimoni: Apache in front, a Node.js App that actually runs the code, Supabase in the cloud, company email on Host Africa.

Kalimoni put a static SPA in `public_html` and a small Express API beside it. Amplus is a full store (SSR, checkout, tickets, mail, webhooks), so the Node app serves **the whole site**, not only `/api`.

## What you need in DirectAdmin

You already have this (from the panel screenshots):

| DirectAdmin | Use |
|-------------|-----|
| Extra Features → **Setup Node.js App** | Run Amplus |
| Advanced Features → **Cron Jobs** | 24h unpaid-order emails |
| E-mail Manager | `@amplusconstructionsolutions.com` |
| SSL | Let’s Encrypt / AutoSSL for the domain |
| FTP | Upload the built app |

Do **not** install WordPress or Site Builder on this domain. That would fight the Node app.

Do **not** use Host Africa MySQL. The database is **Supabase**.

## One-time: Node.js App

1. Extra Features → **Setup Node.js App** → Create.
2. **Node.js version:** 20.x (or 22.x). Not 16.
3. **Application mode:** Production.
4. **Application root:** a folder **outside** `public_html`, e.g. `/home/USER/amplus-connect`.
5. **Application URL:** the site root — `/` or `https://amplusconstructionsolutions.com/` (same idea as Kalimoni’s API URL, but for the whole domain).
6. **Application startup file:** `hosting/hostafrica/server.mjs`
7. **Environment variables** in the Node app (or a `.env` file in the application root). Template: [`hosting/hostafrica/env.example`](hosting/hostafrica/env.example).
8. Open **SSL** for `amplusconstructionsolutions.com` (and `www` if you use it).

If the Node.js App screen shows a **port**, note it. You only need [`hosting/hostafrica/htaccess.proxy`](hosting/hostafrica/htaccess.proxy) in `public_html` if the domain still serves the default Apache page after the app is created. Replace `3000` with that port.

If the panel already attached the domain to Node, leave `public_html` alone.

## Build on your PC (do not build on Web_Basic)

Shared hosting RAM is too small for `vite build`. Build locally, then upload.

```sh
npm install
# Fill .env for the *build* (all VITE_* company/bank/Supabase public keys)
npm run build
node scripts/check-hostafrica-env.mjs
npm run pack:hostafrica
```

`pack:hostafrica` writes `dist-hostafrica/` with:

- `.output/` — Node server + static assets
- `hosting/hostafrica/server.mjs` — startup file
- `package.json` — `npm start`

FTP **the contents of** `dist-hostafrica/` into the Node **application root**. Then on the server create `.env` from `hosting/hostafrica/env.example` (secrets). Do not upload your laptop `.env`.

Restart the Node.js App.

`VITE_*` values are baked in at **build** time. Changing company phone/email/bank on the server `.env` does not update the storefront until you rebuild and re-upload.

Server-only secrets (`SUPABASE_SERVICE_ROLE_KEY`, Gmail, `CRON_SECRET`, Pesapal/Paystack secrets) are read at **runtime** from `.env` / the panel.

## Required live env

| Key | Why |
|-----|-----|
| `PUBLIC_APP_URL` | `https://amplusconstructionsolutions.com` — emails and cron links |
| `SUPABASE_URL` + publishable key + `SUPABASE_SERVICE_ROLE_KEY` | Auth, store, admin |
| `GMAIL_USER` + `GMAIL_APP_PASSWORD` | Receipts, fulfilment, 24h reminders |
| `CRON_SECRET` | Protects `/api/cron/order-reminders` |
| Payment keys | Optional until the client pays for live Pesapal/Paystack |

## Supabase SQL (must be applied on the live project)

In the Supabase SQL editor, in order if they are not already there:

1. Existing base migrations / `supabase/full_setup.sql` if this is a new project
2. `supabase/migrations/20260929120000_support_tickets.sql`
3. `supabase/migrations/20260929153000_cancel_unpaid_orders.sql`
4. `supabase/migrations/20260929180000_fulfilment_times.sql`

## Cron (DirectAdmin)

Advanced Features → Cron Jobs. Example: [`hosting/hostafrica/crontab.example`](hosting/hostafrica/crontab.example).

```
0 * * * * curl -fsS -H "Authorization: Bearer YOUR_CRON_SECRET" https://amplusconstructionsolutions.com/api/cron/order-reminders
```

## Smoke test after restart

```sh
curl -sS https://amplusconstructionsolutions.com/api/health
```

Expect `{"ok":true,"service":"amplus-connect",...}`.

Then in the browser:

- `/` home
- `/products` catalogue
- `/auth` sign in
- `/checkout` (unpaid path is fine without live Pesapal)
- `/account` orders
- `/admin` staff
- Deep link: open `/products` in a new tab (SSR must not 404)

If Pesapal/Paystack go live later, register:

- IPN: `https://amplusconstructionsolutions.com/api/public/pesapal/ipn`
- Paystack webhook: `https://amplusconstructionsolutions.com/api/public/paystack/webhook`

## Local preview of the Host Africa build

```sh
npm run build
npm start
```

Opens the Nitro server (default port 3000 unless `PORT` is set). Use `HOST=127.0.0.1`.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Default Host Africa / DirectAdmin page | Node app is not bound to `/`. Fix Application URL, or install `htaccess.proxy` with the real port |
| `Missing .output/server/index.mjs` | Upload the packed build; startup file path is wrong |
| 502 / proxy error | Node not running — Restart Node.js App; check the port in `.htaccess` |
| Site works but login/checkout CSRF fails | App must see `https` via `X-Forwarded-*`. `trustProxy` is on; Apache must `ProxyPreserveHost On` |
| Health OK but pages look old | `VITE_*` need a new `npm run build` + re-upload `.output` |
| Tickets 404 / PGRST205 | Support tickets SQL not applied on live Supabase |
| Reminders never send | Cron + `CRON_SECRET` + Gmail app password |
| Email works, site on wrong host | Keep MX/email on Host Africa; only the web vhost goes to Node |

## What Host Africa is still not

- No Cloudflare Worker on this plan — that is why the production Nitro preset is **`node-server`**.
- No live Equity auto-confirm (corporate APIs are paid). Staff still confirm bank/M-Pesa.
- Do not commit `.env`.
