# Amplus Connect — Progress Report

**Prepared for:** Amplus Construction Solutions — Managing Director
**Prepared by:** Globcons Ltd
**Date:** 11 September 2026
**Overall status:** Site & admin system built · payments in test mode, pending business setup

---

## 1. Executive summary

Amplus Connect is functionally complete as a website and back-office system. The
customer-facing storefront and corporate site, and the staff admin panel used to run
it day to day, are both built and working end to end. The one piece not yet switched
on is real payment collection — and getting there from here is a **business task, not
a coding task**.

**The key thing to understand:** the system already has **Pesapal** wired into
checkout, in full, in code. Pesapal is a single payment gateway that — once switched
from test mode to a live business account — hands us M-Pesa, Airtel Money, Visa,
Mastercard, Amex and bank payments together, through the one connection. So **M-Pesa,
Airtel Money, Visa, and Pesapal are not four integrations to build — they are one:
Pesapal.** What's left is opening and verifying a Pesapal business account (Section
6), which needs company documents and action from Amplus, plus one decision on where
the live site is hosted (Section 7).

---

## 2. The public website

What a customer or visitor sees and can do today, browsing
amplusconstructionsolutions.com:

| Page | Status |
|---|---|
| Home | Built |
| About | Built |
| Services (list + detail) | Built |
| Projects / portfolio (list + detail) | Built |
| Insights / blog (list + detail) | Built |
| Product store (list + detail, with photos, stock, pricing) | Built |
| Cart & checkout | Built — test mode |
| Order confirmation | Built — test mode |
| Customer accounts (sign in/up, order history, loyalty points) | Built |
| Contact form (delivers to admin inbox) | Built |

---

## 3. The admin control panel

The staff-only back office for running the site. Staff sign in to a dedicated admin
area to manage everything a construction business needs to keep the site current,
without touching code:

- **Products & categories** — add materials, prices, stock levels and photo galleries.
- **Services, projects & insights** — publish and edit the service list, project
  portfolio and blog posts.
- **Orders** — view and fulfil customer orders as they come in.
- **Customers** — see the customer list and their history.
- **Messages** — every contact-form enquiry lands here.
- **Rewards** — configure the customer loyalty-points programme.
- **Staff roles** — a super-admin can grant or revoke other staff members' access, so
  account control stays with one or two trusted people.

---

## 4. Database & backend

Amplus Connect runs on Supabase, a hosted, secure database. Access rules are enforced
at the data level, not just in the screens shown: a customer can only ever see their
own orders and details, and only signed-in staff can edit site content — even if
someone tried to bypass the website itself.

Two recent fixes, for context:

- **6 September** — fixed a bug that briefly blocked anonymous visitors from browsing
  the public catalogue.
- **10 September** — added photo-gallery support for products, along with
  stock-safe inventory logic that prevents two near-simultaneous orders from both
  selling the last unit of an item.

---

## 5. Payments — where things stand

Checkout already creates the order, redirects the customer to a hosted Pesapal
payment page, and listens for Pesapal's payment confirmation (a webhook called an
**IPN**) to mark the order paid, deduct stock, award loyalty points and email a
receipt automatically. Nothing here is a prototype — it is the real flow, currently
pointed at Pesapal's *sandbox* (test) environment because we don't yet have live
credentials.

**How a payment moves:**

```
Customer → Amplus Connect checkout → Pesapal (hosted payment page)
                                          ├─ M-Pesa (STK push)
                                          ├─ Airtel Money
                                          ├─ Visa / Mastercard / Amex
                                          └─ Equity / Co-op / bank
                                          ↓
                              Amplus bank account (settlement, 1–5 business days)

Pesapal → IPN webhook → Amplus Connect
  confirms payment · order marked PAID · stock updated · receipt emailed
```

The customer never leaves Pesapal's own secure page to pay; Pesapal accepts M-Pesa,
Airtel Money, cards or bank in one place, then calls back to Amplus Connect to
confirm the sale and settles funds into the Amplus bank account on its normal
schedule.

### Why this matters for planning

| Payment method on the client's list | What it actually needs |
|---|---|
| M-Pesa | Already covered — reaches Amplus via Pesapal's M-Pesa STK push, no separate Safaricom integration needed. |
| Airtel Money | Already covered — same Pesapal connection, no separate Airtel integration needed. |
| Visa (& Mastercard, Amex) | Already covered — Pesapal's hosted card checkout, no separate card processor needed. |
| Pesapal | This *is* the integration. It's built. It needs a live business account, not more code. |

---

## 6. What Amplus needs to do

The punch list to take payments from test mode to real money — this side of the work
sits with Amplus, not with development.

1. **Confirm the registered business entity** *(decision)* — the Pesapal account is
   opened in the name of the registered company (Amplus Construction Solutions),
   matching its official registration documents.
2. **Gather the KYC document set** *(action)* — see table below. Almost always the
   slowest step, so starting early matters more than anything else here.
3. **Apply for a Pesapal Business Account** *(action)* — register at
   pesapal.com/business and sign Pesapal's merchant agreement/contract. We can
   prepare and submit this alongside Amplus once the documents are ready.
4. **Nominate the settlement bank account** *(decision)* — the account that receives
   sale proceeds from Pesapal — needs a cancelled cheque or a bank confirmation
   letter as proof.
5. **Receive live credentials, we switch the site over** *(development)* — once
   Pesapal approves the account, they issue a live consumer key and secret.
   Development plugs these in, switches checkout from test to live mode, and
   registers the live payment-confirmation webhook.
6. **Run one small real transaction together** *(development)* — a real, low-value
   purchase, end to end, before opening checkout to the public — the same way any
   till or POS system is tested before go-live.

### Documents Pesapal will ask for (registered limited company)

| Document | Notes |
|---|---|
| Certified Certificate of Incorporation | Certified copy required |
| Latest CR12 | Confirms current directors/shareholders |
| Company KRA PIN certificate | — |
| Directors' ID/passport copies | All listed directors |
| Directors' KRA PIN certificates | All listed directors |
| Cancelled cheque or bank confirmation letter | For the settlement account |
| Board resolution | Authorising the business relationship with Pesapal |
| Ultimate Beneficial Ownership (UBO) declaration | Pesapal or Business Registration Service form |
| Signed Pesapal merchant agreement | Issued by Pesapal on application |

### Fees & settlement, for budgeting

| Item | Typical rate |
|---|---|
| M-Pesa transaction fee | 3.0% – 3.5% |
| Card transaction fee (Visa/Mastercard/Amex) | 3.5% – 4.5% |
| Sign-up / monthly fee | None |
| M-Pesa settlement to bank | 1–3 business days |
| Card settlement to bank | 3–5 business days |

Faster, real-time settlement is available at higher account tiers via Pesapal's
Openfloat e-wallet — worth asking about directly once volume justifies it. Exact fees
and the account-approval timeline are set by Pesapal and worth confirming in writing
during application, as they can vary by account tier and are not fully published.

---

## 7. The hosting decision

A second decision that's linked to payments going live, not a separate issue.

The HostAfrica `Web_Basic` plan already paid for is classic shared hosting — built
for WordPress or static/PHP sites. Amplus Connect is a different category of
application: it runs live server code on every request (for checkout, the admin
panel and the Pesapal webhook), which shared hosting of this type cannot execute.
This isn't a settings change — the app was built for, and needs, a Node/edge server
environment.

**Why this can't wait until launch day:** Pesapal's payment-confirmation webhook
(Section 5's diagram) needs a permanently live, public web address to call. That
address only exists once the real site is deployed somewhere that can run it — so
the live site needs to be deployed *before* the live Pesapal webhook can be
registered.

**Recommendation:** deploy the live site on Cloudflare (the platform it's already
built for — a near-zero-cost move) and point amplusconstructionsolutions.com at it.
Keep the HostAfrica plan for what it's still useful for: the company's email
accounts and, optionally, DNS management. Full detail is in
[HOSTING-ASSESSMENT.md](HOSTING-ASSESSMENT.md).

---

## 8. Recommended timeline

Sequenced by who's holding the pen at each step.

| Step | Owner | Time |
|---|---|---|
| A. Deploy the live site to Cloudflare | Development | Days — independent of payments, can start immediately |
| B. Amplus gathers KYC documents & applies to Pesapal | Client | ~1–2 weeks, document-dependent — the long pole; run in parallel with (A) |
| C. Pesapal reviews & approves, issues live credentials | Pesapal | Timeline set by them — confirm their current SLA when applying |
| D. Switch checkout to live mode, test a real transaction, launch | Development | Under a day once (A) + (C) are done |

---

## 9. Sign-off checklist

- [x] Public website built and working (Section 2)
- [x] Admin control panel built and working (Section 3)
- [x] Database, security rules and backend logic in place (Section 4)
- [x] Pesapal checkout & payment confirmation built, running in test mode (Section 5)
- [ ] Amplus confirms registered entity details & settlement bank account (Section 6)
- [ ] Amplus gathers KYC documents & submits Pesapal business application (Section 6)
- [ ] Decision on Cloudflare hosting confirmed (Section 7)
- [ ] Live credentials received, checkout switched to live mode, test purchase run (Sections 6 & 8)

---

### References consulted for the payments section

- [Pesapal — documents required with the merchant contract](https://www.pesapal.com/support/business-account/what-documents-do-i-need-to-submit-with-contract)
- [Pesapal — how to open a business account](https://www.pesapal.com/support/business-account/how-to-open-a-pesapal-business-account)
- [Pesapal Developer — IPN URL registration (API 3.0)](https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/registeripnurl)
- [Pesapal — real-time settlement via Openfloat](https://www.pesapal.com/blog/boost-for-businesses-as-pesapal-introduces-real-time-settlement-of-payments-in-kenya)

Questions on any item above: info@globeconcs.com
