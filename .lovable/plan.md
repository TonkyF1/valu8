# Valu8 — App Store Readiness Pass

Goal: turn Valu8 into a polished, sellable v1 — bugs squashed, missing essentials added, native iOS shell ready, all features unlocked (Stripe stub kept).

## 1. Audit & bug fixes
- Walk every screen at 430×697 (Auth, NewValuation, Analysing, Report, EditValuation, Dashboard, Profile, legal pages) and fix:
  - Broken/empty states, layout overflow on small screens, safe-area issues.
  - Console errors and React Router v7 future-flag warnings.
  - Any edge function failures (test analyse-vehicle, lookup-vehicle, marketcheck-count, similar-cars, generate-advert, historical-valuation).
- Unify error handling: every async call shows a toast on failure, no silent dead-ends.
- Tighten loading states (skeletons instead of blank screens on Dashboard/Report).

## 2. Auth & account essentials
- Verify Google sign-in works end-to-end; add clean error toast on cancel/deny.
- Add **password reset** flow (request email + update-password screen).
- Add **delete account** action in Profile (calls an edge function that purges profile, valuations, photos, then signs out).
- Add **sign out everywhere** and a confirm dialog around destructive actions.

## 3. Monetisation (free for now, UI intact)
- Keep "Upgrade" buttons visible but route them to a "Coming soon" sheet.
- Unlock every premium-gated feature (advert generator, history chart, similar cars, PDF export) for all signed-in users.
- Remove any code paths that throw/blank-out for non-premium users.

## 4. Legal & store compliance
- Make Privacy, Terms, Disclaimers content actually launch-grade (UK private-seller wording, data handling, AI disclaimer, MOT/MarketCheck attribution).
- Link them from Auth screen and Profile.
- Add "Guidance only, not a regulated valuation" disclaimer on every Report.

## 5. Native iOS shell (Capacitor)
- Install `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`, `@capacitor/status-bar`, `@capacitor/splash-screen`, `@capacitor/haptics`.
- Create `capacitor.config.ts` with appId `app.lovable.101f88bb9f154d61bcf3d147a9f39355`, name `Valu8`, hot-reload server URL pointing at the sandbox.
- Add safe-area CSS (`env(safe-area-inset-*)`) to the sticky header, bottom CTAs, and modals.
- Status bar + splash configured for dark theme (#111111).
- Provide README steps for `npx cap add ios && npx cap sync && npx cap run ios` after GitHub export.

## 6. Polish
- App icon + splash assets (generated, dark teal theme).
- 404 page: friendly, branded.
- Empty Dashboard: clear "Create your first valuation" CTA.
- Profile: avatar upload feedback, success toasts.
- Consistent button sizes ≥44px tap targets.
- Replace any `text-gray-*` arbitrary colors with semantic tokens.

## 7. Verification
- Run build, fix any TS errors.
- Hit each edge function with curl to confirm 200s.
- Click through full happy path: signup → new valuation → analysing → report → edit → delete → profile → sign out.
- Confirm preview is clean of red errors.

## Out of scope
- Stripe / real payments (stub only).
- Push notifications (Capacitor plugin not added — can be added later).
- Android shell (iOS-first).

## Deliverables
- Updated code across pages, components, edge functions.
- New `capacitor.config.ts` + Capacitor deps.
- New password-reset and delete-account flows + edge function.
- Coming-soon paywall replacement.
- Brief release-checklist note at the end of the response.
