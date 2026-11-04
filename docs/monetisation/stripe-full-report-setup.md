# £2.99 Full Valuation Report — Stripe Embedded Checkout setup

Status: built, **not live**. Nothing changes for users until the switches in step 5 are on.
Never paste keys into chat or commit secret keys to the repo.

## 1. Backend secrets (Lovable → project → toolbar **More** → **Secrets**)
Add (names exactly):
- `STRIPE_SECRET_KEY` — Stripe Dashboard → Developers → API keys → Secret key (`sk_live_…`), or a restricted key with Checkout Sessions write.
- `STRIPE_WEBHOOK_SECRET` — the `whsec_…` signing secret from step 3.
- optional `STRIPE_REPORT_PRICE_ID` — defaults to `price_1UYCy92Eh7OGTq97k6YAUz9I` (£2.99 GBP).
- optional `SITE_URL` = `https://valu8.uk` (used for the return URL; otherwise the request Origin).

## 2. Frontend publishable key
`VITE_STRIPE_PUBLISHABLE_KEY` = `pk_live_…` (Developers → API keys → Publishable key). Vite bakes it in at
build time, so Lovable Secrets do NOT reach the browser. Add it to the project's `.env`
(`VITE_STRIPE_PUBLISHABLE_KEY="pk_live_…"`), e.g. ask Lovable chat "add VITE_STRIPE_PUBLISHABLE_KEY to .env",
then republish. A publishable key is designed to be public; the secret key must never go there.

## 3. Webhook (Stripe Dashboard → Developers → Webhooks → Add destination)
- Endpoint URL: `https://rmdaeltradwukimbzxor.supabase.co/functions/v1/stripe-webhook`
- Events: `checkout.session.completed` (also recommended: `checkout.session.async_payment_succeeded`)
- Copy the signing secret → `STRIPE_WEBHOOK_SECRET` (step 1).

## 4. Apple Pay / Google Pay
- Dashboard → Settings → Payment methods: enable Card, Apple Pay, Google Pay.
- Dashboard → Settings → Payment methods → **Payment method domains** → Add `valu8.uk` (and `www.valu8.uk` if used).
  Stripe checks `https://valu8.uk/.well-known/apple-developer-merchantid-domain-association` (already served).
- Dashboard → Settings → Branding: background `#111111`, button/accent `#00D6C8`, font Inter — embedded
  Checkout takes its look from Branding (the in-iframe Appearance API isn't available for Embedded Checkout).

## 5. Go live (only when ready)
Stripe account activated, then set BOTH switches:
- Lovable Secrets: `PREMIUM_ENFORCED=true` (server; `create-checkout-session` returns 503 until then)
- `.env`: `VITE_PREMIUM_ENFORCED=true` (frontend lock + checkout UI), republish.

## How it works
- `create-checkout-session` (public): `ui_mode=embedded`, `mode=payment`, the price, automatic payment methods,
  `client_reference_id` + `metadata.valuation_id`/`reg`, `return_url=/valuation/<id>?session_id={CHECKOUT_SESSION_ID}`.
- `stripe-webhook`: verifies signature; on `checkout.session.completed` with `metadata.kind=full_report` and
  `payment_status=paid`, upserts `report_purchases` (unique `stripe_session_id` → idempotent).
- `report_purchases`: RLS on, owners can SELECT, no client write policies (service role only).
- `report-entitlement` returns `{paid}` from that table; Report.tsx unlocks only from it (the return URL just
  triggers a ~30 s re-check while the webhook lands).
