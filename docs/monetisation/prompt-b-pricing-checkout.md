# Prompt B — pricing page, Stripe checkout, lock UI, account billing (DRAFT — not sent)

**Send only after:** (1) the readiness gate in `readiness.md` passes, (2) Tony has created Stripe
products/prices and approved final prices. Refund wording, no-VAT and legal name are decided (see README → Decisions). Everything is built behind the
existing flags — `PREMIUM_ENFORCED` and `VITE_BILLING_ENABLED` stay **off** until Tony flips them.
Copy comes from `docs/monetisation/copy.md`; feature→plan mapping from `src/lib/entitlements.ts`.

---

## Prompt text (copy from here)

Goal: get Valu8 ready to charge, all hidden behind the existing flags (`VITE_BILLING_ENABLED`, `PREMIUM_ENFORCED` — leave both off). Reuse what exists: `stripe-checkout`, `stripe-webhook`, `stripe-portal`, `_shared/stripe.ts`, `billing_customers`, `guard.ts`. Use copy from `docs/monetisation/copy.md` word for word. Don't touch `analyse-vehicle`, `_shared/priceModel*`, `motSignals`, `ensemble`, deno.lock.

1. **Products**: secrets `STRIPE_PRICE_REPORT` (£4.99 one-off), `STRIPE_PRICE_BUYER` (£7.99/mo), `STRIPE_PRICE_SELLER` (£4.99 one-off). Keep `STRIPE_PRICE_ID` as a fallback for buyer.
2. **Migration**: `purchases` (id, user_id → auth.users cascade, product 'report'|'seller_pack', item_kind 'valuation'|'advert', item_id uuid, stripe_session_id unique, amount_pence int, consent_at timestamptz, created_at). RLS: users read own, admins read all, service role writes. SQL helper `has_item_access(item_id, product)` (owner purchase OR active/trialing buyer subscription for 'report' OR admin).
3. **stripe-checkout**: accept `{ product, itemKind, itemId, consent }`. Report/seller pack → `mode: payment` with metadata (user_id, product, item_kind, item_id, consent_at); buyer → `mode: subscription` (subscribers also get the Full Report on every car while active). Require `consent: true` for one-off products (checkbox: "Start my report now. I understand that once it's delivered I lose my 14-day right to cancel."). success_url returns to the item; cancel_url to where they came from.
4. **stripe-webhook**: on `checkout.session.completed` with mode payment, insert a `purchases` row (idempotent on session id). Subscriptions: keep current logic, set `plan = 'buyer'`.
5. **Entitlements**: add `useEntitlements()` that loads the user's purchases + `billing_customers.status` and calls `entitlementFor()` from `src/lib/entitlements.ts`. Fix `useProfile`: stop hard-coding `isPremium: true`, default missing profile to free, remove client `setPremium`. While enforcement is off everything stays unlocked, so there's no visible change.
6. **Server gating (only when `PREMIUM_ENFORCED=true`)**: `fair-price` → free with the 10/day cap, uncapped for buyer subscribers (replace `requirePremium: true`). `get-shared-valuation` and a new `get-report` function strip locked sections unless `has_item_access`. The owner's Report page reads through `get-report` when enforced. Locked keys must never reach the browser.
7. **Full Report sections** (buyer view, deterministic, no extra AI calls): MOT red flags (use existing MOT data/flags read-only), recall campaigns (existing `recall-check`), fair-price verdict + offer guidance (from the fair-price band: opening offer, walk-away), seller questions (template from age, mileage, MOT advisories, fuel). Seller pack = existing asking price (`askRange`) + `generate-advert`.
8. **Lock UI**: `<LockedSection feature=…>` shows the section title, the teaser line from copy.md (counts only, never the finding), a soft blur and one button. Signed out → "Sign in to unlock". Only renders a lock when `entitlementFor(...).allowed` is false, so nothing changes while off.
9. **Pricing page**: rebuild `/pricing` with the 3 cards + seller strip, matrix and FAQ from copy.md. When billing is off keep today's "free during early access" message.
10. **Account → Billing** (Profile): plan, renewal/end date, "Manage or cancel" (stripe-portal), list of purchased reports with links. Hidden unless `VITE_BILLING_ENABLED`.
11. **Terms**: add a Payments & refunds section using the FAQ refund answer in copy.md: digital content delivered immediately with consent, 14-day cancellation right lost once delivered (Consumer Contracts Regulations 2013); full refund if a report fails to load or is clearly broken (email hello@valu8.uk); subscriptions cancel any time, access to end of paid month, no partial refunds. Seller: "Tony Fisher trading as Valu8", contact by email only. No VAT wording anywhere (not VAT-registered).

Acceptance: with flags off, no visible change anywhere except new pages hidden behind the flag; with test keys and flags on, buying a report unlocks only that car, subscribing unlocks buyer tools, cancelling via portal works, and locked JSON never reaches the client.
