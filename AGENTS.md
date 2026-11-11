# Frontend SEO architecture

- Keep public route metadata in the Node-safe `src/data/routeMeta.ts`; pages, build HTML and sitemaps consume it to prevent drift.
- Generate route head variants with a dependency-free build-only Vite plugin; preserve the SPA body and fail when required template tags are missing.
- Advert-check outcome logging lives in fair-price/advert-followup/recheck-adverts; logging must be best-effort so a logging failure never changes or breaks a price result. Link denylist + robots rules live in _shared/adverts.ts and _shared/robots.ts (single source for both).
- App emails go through Resend from supabase/functions/email-dispatch (DB trigger for report emails, daily cron for follow-ups) with _shared/email.ts; every email must carry the signed unsubscribe link and respect email_suppressions, so one opt-out stops all mail.
- Homepage car imagery uses modelRenders model/year matching with body-shape fallbacks and displays source images directly, avoiding canvas repaint overhead.
- The homepage price-arc grade is computed client-side in src/lib/carGrade.ts from real report signals only (mileage for age, latest DVSA MOT, photo score, MOT mileage drop); unchecked items like finance/write-off must never feed it.
