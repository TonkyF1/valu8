# B2: photo sanity, guest cap per device, valuation confidence (21 Nov 2026)

PR only. Nothing here is deployed until the `analyse-vehicle` edge function is deployed.

## 1. Photo checks (`supabase/functions/_shared/photoSanity.ts`)

What the audit found: four photos of three different-coloured Fiestas all came back as "value-add", the condition
score was 7.2/10, and the scuff the seller declared was ignored.

Now:

- **Same car in every photo.** For every photo, the vision model now reports `photoCars[]`: whether it shows the outside of the car, the paint colour and any readable number plate. It also answers `photosSameCar`. The server flags different cars when any of these hold:
  - two exterior photos are in clearly different colours (lighting look-alikes such as silver/grey or black/dark blue are allowed);
  - two different plates can be read;
  - the model says the photos aren't the same car.
- **Matches the DVLA record.** The car is flagged if its colour family differs from the DVLA colour (e.g. blue vs red), or if a readable plate isn't the registration that was entered.
- **When either check fails:**
  - the photos don't move the price at all: no uplift, no deduction, and no condition score in the price;
  - "positive" photo items become neutral;
  - photo praise is dropped from strengths;
  - the condition shows as "Not scored (photos didn't match)", with a neutral 7.0 so the existing UI and PDF never print `null`;
  - a polite note leads the watch points, e.g. *"The car in your photos looks blue, but the DVLA record says red. If it's been resprayed or wrapped, that's fine. We just haven't used the photos to adjust the price."*
- **Declared damage is honoured.** If the seller declares a scuff, scratch, dent, chip, kerbed alloy, crack, rust, tear, stain or fade:
  - photos can never add value;
  - a "clean, no visible scuffs" item can't be positive;
  - the condition score is capped at 7.5;
  - the note says *"You mentioned a scuff. We've allowed for it, even where it isn't visible in the photos."*
  - Negated or repaired mentions don't count: "no scratches", "dent repaired", "wear and tear".
- `report.photoCheck` (`trusted`, `differentCars`, `colourMismatch`, `plateMismatch`, `declaredDamage`, `notes`) is saved, so the report page can show a dedicated banner later. That would be a Report.tsx change in workstream A. Until then the note shows through the existing watch points.

## 2. Guest cap per device, Turnstile behind a flag (`_shared/guestCap.ts`)

**Before:**
- The 3-a-day free cap applied to the IP and to the device token at the same number.
- So everyone behind one IP shared 3 valuations: a mobile carrier's NAT, an office, a household or a café.

**Now:**

| Setting (Supabase secret) | Default | Meaning |
|---|---|---|
| `GUEST_DAILY_CAP` | 3 | Free valuations per device token per day (unchanged) |
| `GUEST_IP_DAILY_CAP` | 15 | Shared-connection ceiling per IP per day |
| `GUEST_IP_DAILY_CAP_TS` | 60 | The same ceiling when Turnstile is on (minting new device tokens costs a human check) |
| `GUEST_PREMIUM_CAP` | 8 | Paid-path valuations per device per day (IP gets at least 2x) |
| `GUEST_CAP_MODE=ip` | off | Restores the old per-IP behaviour without a code change |
| `TURNSTILE_SECRET_KEY` | unset | Turnstile stays off until this is set |
| `TURNSTILE_MODE` | `guests` | `guests` (signed-out callers only), `all`, or `off` (kill switch) |

- The device token is checked first, so a used-up device doesn't also burn a slot of the shared IP ceiling.
- **Turnstile setup:** the free Cloudflare account doesn't need a DNS move. Do these steps in this order, or guests get "Human verification failed":
  1. Cloudflare dashboard → Turnstile → Add widget. Hostname `valu8.uk` (add `www.valu8.uk` too). Mode: Managed.
  2. Lovable → project env: `VITE_TURNSTILE_SITE_KEY=<site key>`. Publish the frontend. The home flow already renders the widget and sends `x-turnstile-token`.
  3. Supabase → Edge Function secrets: `TURNSTILE_SECRET_KEY=<secret key>`. Then deploy `analyse-vehicle`.
  4. If anything goes wrong, set `TURNSTILE_MODE=off`. No redeploy is needed.
- Note: the older `/valuation/new` page doesn't send a Turnstile token. That's why the default mode is `guests`, which signed-in users skip.

## 3. Confidence and unpriced valuations: what's behind the ~45%

**Data:** production `valuations` from the last 30 days (315 rows), read-only.

| | Rows | Low + Very Low |
|---|---|---|
| All | 315 | 143 (45.4%) |
| Excluding agent/QA test runs | 284 | 127 (44.7%) |
| Distinct cars | 197 | 92 (46.7%) |

Causes, for distinct Low/Very Low cars:

| Cause | Cars | Notes |
|---|---|---|
| Cross-source guard ("our data sources disagree") | 28 | AI vs comps diverge. Deliberate safety net; needs a separate review |
| Engine shown but capped at Low | 27 | By design: cars over 15 years old, or thin model data, miss the range more often (eng-4 audit) |
| AI fallback: no same-model comps | 22 | Partly fixable: see below |
| Old-car rule | 6 | 20+ year-old cars |
| MarketCheck-era rows | 4 | MarketCheck is now off |
| Unpriced | 5 | See below |

**Unpriced: 8 rows, 5 distinct cars.** All five are deliberate "we'd rather not mislead" outcomes:
- a 4.0 petrol A6 (RS6/S6?) and a 4.2 petrol A4 (RS4/S4?), where the user is asked to confirm the variant;
- a BMW M5 Competition, a 2010 Civic Type R and a 2005 Honda Integra, which have too few like-for-like adverts.

Four of the 8 rows are the same agent-test A6. These aren't changed.

**Fix shipped here (conf-1, `_shared/ownComps.ts`, query side only):**
- DVLA/VDG model strings that carry the trim fell to the make-wide pool, which is capped at Low and forces the AI fallback. Examples: "218i M Sport Auto", "C220 Sport CDI A", "Cooper Auto", and the make "SMART (MCC)".
- They now resolve to the advert model ("2 Series", "C Class", "Hatch", "smart"). This applies only when that model has 20 or more comps.
- Training rows are untouched, so the pm-1 parity and the price model are unchanged.

**Replay:** `/workspace/b2/replay.ts`, the own-comps engine on all 284 non-test recent valuations.

| | Model-level comps | Own-comps Low/Very Low |
|---|---|---|
| Before | 248 | 86 |
| After | 256 | 79 |

The cars that moved:

| Car | Before | After | Live shown price |
|---|---|---|---|
| BMW 218i M Sport Auto 2024, 27k mi | make-wide, Low, £21,050 | model, Medium, £16,500 | £15,250 (AI) |
| BMW 330e M Sport 2020, 48k | make-wide, Low, £13,950 | model, High, £13,500 | £16,400 (AI, Very Low) |
| BMW 118i M Sport 2016, 32k | make-wide, Low, £10,600 | model, High, £8,750 | £9,900 (AI) |
| Mercedes C220 CDI 2008, 166k | make-wide, Low, £1,800 | model, High, £1,650 | £1,450 |
| MINI Cooper Auto 2013, 71k | make-wide, Low, £4,500 | model, High, £4,150 | £4,850 |
| smart fortwo coupe 2012, 27.5k (2 rows) | global, Very Low | model, High, £2,000 / £2,950 | £3,450 / £3,350 |
| Mercedes A 180 AMG Line 2018 | family | model | |

- For these cars the shown-price engine (ens-3) now runs instead of the AI fallback.
- The engine's own rule then gives Medium for cars up to 15 years old with 20 or more model comps. So the estimate is that about 7 of the 92 distinct Low/Very Low cars move to Medium, which is about 47% down to about 43%.
- The rest is mostly the cross-source guard and the age rule. Both are deliberate and should be reviewed with fresh holdout data rather than loosened blind.
