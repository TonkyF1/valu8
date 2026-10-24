# Valu8 monetisation — audit & plan (Oct 2026)

Status: **nothing is charged.** `PREMIUM_ENFORCED` stays off, no Stripe keys are set, and the
frontend flag `VITE_BILLING_ENABLED` is off. This folder is the prep work for the day we switch on.

Files here:
- `copy.md` — pricing page, lock/teaser copy per locked section, free-vs-paid matrix, FAQ.
- `readiness.md` — the "ready to charge" accuracy dashboard spec + SQL + go/no-go thresholds.
- `prompt-a-outcome-tracking.md` — draft Lovable prompt (outcome follow-ups + readiness logging). Not sent.
- `prompt-b-pricing-checkout.md` — draft Lovable prompt (pricing page, Stripe checkout, lock UI, account billing). Not sent.
- Code: `src/lib/entitlements.ts` (+ `src/test/entitlements.test.ts`) — feature → plan map; everything unlocked until enforcement is on. Not wired into any page.

## Business model (prices are placeholders)
| Product | Price | What it unlocks |
|---|---|---|
| Free | £0 | Basic valuation (guest 3/day), MOT summary, advert checker (10/day/IP) |
| Full Report | £4.99 per car | MOT red flags in plain English, recall check, fair-price verdict, offer guidance, seller questions |
| Buyer subscription | £7.99/month | Unlimited advert checks, saved cars, price alerts, and the Full Report on every car while subscribed (`SUBSCRIPTION_INCLUDES_REPORT = true`) |
| Seller pack | £4.99 per car (placeholder) | Suggested asking price + ready-to-post advert text |

Charging starts only when the readiness gate in `readiness.md` passes (≥200 real outcomes, £5–20k cars, median abs error ≤12%, <5% of misses >30%).

## Audit — what already exists

| Area | Where | State | Reusable? |
|---|---|---|---|
| Server premium flag | `supabase/functions/_shared/guard.ts` → `premiumEnforced()`, `isPremiumUser()`, `guard({requirePremium})` returns 402 `premium_required` | Off (env `PREMIUM_ENFORCED` unset). Premium = `profiles.is_premium` OR admin role | **Yes** — the gate for subscription features. Needs a per-car check added for Full Report / Seller pack. |
| Who uses `requirePremium` | `fair-price` (advert checker) passes `requirePremium: true`; `analyse-vehicle` has a premium check behind the flag | Dormant | ⚠️ `fair-price` would lock the **free** advert checker entirely if the flag were flipped. Must change to "free with 10/day, unlimited for subscribers" before enforcement. |
| Guest / rate caps | `guard.ts` `checkLimit` + `rate_limits` table; guest valuations 3/day; guest advert checks `GUEST_CHECK_DAILY_CAP` 10/day/IP | Live | **Yes** — subscriber "unlimited" = skip/raise cap when premium. |
| Stripe helpers | `_shared/stripe.ts` (REST, no SDK, webhook signature verify) | Inactive until `STRIPE_SECRET_KEY` | **Yes**, as is. |
| Checkout | `stripe-checkout` — one `STRIPE_PRICE_ID`, mode subscription (or payment via `STRIPE_MODE`), requires sign-in | Inactive (503 `billing_inactive`) | **Partly** — needs a `product` param (report / subscription / seller_pack), per-product price IDs, and `metadata[valuation_id]` for per-car buys. |
| Webhook | `stripe-webhook` — syncs `billing_customers`, sets `profiles.is_premium/plan`; never downgrades while flag off | Inactive | **Partly** — handles subscriptions only. Needs one-off payment handling that writes a per-car purchase row. |
| Portal | `stripe-portal` → Stripe billing portal, return `/profile` | Inactive | **Yes**, as is. |
| Billing table | `billing_customers` (user_id, stripe ids, status, price_id, period end; RLS own-read + admin) | Exists | **Yes** for subscriptions. Need new `purchases` table for per-car items. |
| Privilege guard | trigger `prevent_profile_privilege_escalation` blocks users editing `is_premium`/`plan` | Live | **Yes** — keep. |
| Frontend flag | `src/lib/billing.ts` `BILLING_ENABLED` (`VITE_BILLING_ENABLED`); Pricing.tsx has its own copy of the same const | Off | Yes — consolidate on `billing.ts`. |
| `useProfile` | `isPremium` hard-coded **true** for every signed-in user; missing profile defaults to `is_premium: true, plan: "monthly"`; exposes a client `setPremium()` (blocked by DB trigger anyway) | Sandbox | Must be changed to read real status before charging (Prompt B). Remove client `setPremium`. |
| Pricing page | `src/pages/Pricing.tsx` — Free "Essentials" vs "Full seller report" (£0 in early access), Upgrade/Manage billing buttons when billing enabled, 3 FAQs | Live (free messaging) | **Yes** — restructure into 3 products using `copy.md`. |
| Dashboard | Premium badge/upgrade CTA, edit-valuation shows crown when not premium & billing on | Live | Yes. |
| Profile | "Subscription & Billing" section removed (comment placeholder at ~L254) | — | Rebuild in Prompt B. |
| Saved cars | Signed-in users' **valuations** are saved (dashboard list). Advert checks are **not** stored anywhere (only a PostHog event `advert_check` with `has_link`). | — | Need `advert_checks` table (Prompt A) → basis for "saved cars". |
| Price alerts | None | — | New (later; after advert_checks exists). |
| Outcomes | "Sold it?" → `report.saleFeedback` → trigger copies to `sale_feedback` table; `public_accuracy_stats()` RPC; `/accuracy` page | Live | **Yes** — core of the readiness gate. Buyer-side outcomes don't exist yet (Prompt A). |
| Recall check | `recall-check` edge function | Live, free | Becomes a Full Report section. |
| Seller tools | `generate-advert` + `AdvertCreator`, asking price (`askRange`, `src/lib/askingPrice.ts`) | Live, free | Become the Seller pack. |

### Gaps to close before charging
1. Per-car purchases table + webhook handling for one-off payments.
2. Product-aware checkout (3 price IDs) and `valuation_id` metadata.
3. Server-side per-section redaction: when enforced and not entitled, `get-shared-valuation` / report reads must omit locked sections (frontend blur alone is bypassable — the full report JSON is in `valuations.report` readable by the owner).
4. `fair-price`: switch from `requirePremium` to free-with-cap (subscribers uncapped).
5. `useProfile`: stop hard-coding premium.
6. Outcome tracking for advert checks (Prompt A) so the readiness gate can be met faster.
7. **Full Report content mostly doesn't exist yet.** Today's report is seller-oriented. Buyer-facing sections — MOT red flags in plain English, offer guidance (opening offer / walk-away), seller questions — need building (Prompt B §7, deterministic, no extra AI cost). Recall campaigns and the fair-price band already exist.
8. Refund/cancellation terms in `Terms.tsx` — wording decided (see Decisions below and copy.md FAQ).

### Build split
- **Local / free (done here):** audit, copy, entitlement helper + tests, readiness spec + SQL, draft prompts.
- **Needs Lovable (DB migration / deploy / UI):** Prompt A, then Prompt B. Prompt A can be merged with the accuracy worker's pending prompt.
- **Needs Tony:** Stripe account + 3 prices, final prices, flipping flags (only after the readiness gate passes).

## Decisions (24 Oct 2026)
1. **Subscription includes the Full Report** on every car while active — `SUBSCRIPTION_INCLUDES_REPORT = true`.
2. **Gumtree re-checks allowed** for adverts users enter themselves (robots.txt-compliant, slow, no personal data — same rules as our collector). Never fetched: AutoTrader, PistonHeads, Motors, CarGurus, Exchange & Mart, eBay, Facebook/Marketplace, Car & Classic, auction sites (plus Carwow, heycar, cinch, Cazoo, kept as a precaution). Outcomes for those come only from the user's follow-up.
3. **No VAT line** — not VAT-registered. Prices are shown as-is, no "inc. VAT".
4. **Refunds:** digital content — buyers consent at checkout to immediate delivery and acknowledge they lose the 14-day cancellation right once the report is delivered (Consumer Contracts Regulations 2013). Full refund if a report fails to load or is clearly broken (email support). Subscriptions: cancel any time, access until the end of the paid month, no partial refunds.
5. **Legal name:** Tony Fisher trading as Valu8. Contact by email only (hello@valu8.uk).
