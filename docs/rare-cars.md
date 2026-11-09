# Rare and performance variants (rare-cars-1, 2026-11-09)

Why: SK51EYX (a 1.8 Honda Integra, built 2001, imported and first UK-registered 2005) was valued as a 2005 car and then
refused ("0 comparable Honda TYPER adverts"). Civic Type Rs, M3s and RS4s were refused the same way.

Root causes
- lookup-vehicle took the year from DVSA `firstUsedDate` (first UK registration) before `manufactureDate`. For imports
  that is years late. Now the build year comes from `manufactureDate` only.
- The variant comps query searched `%typer%` for "type r", so it found 0 of our Civic Type R adverts. It now uses `%type%r%`.
- The variant name was built as `token.toUpperCase()` with spaces removed ("TYPER"). It's now "Integra Type R" / "Civic Type R".

Pricing (analyse-vehicle, eng-4 guard block)
1. Same variant within ±4 years, at least 8 adverts: the existing eng-4 reference (unchanged).
2. Same variant within ±8 years, at least 4 adverts, with wider age and mileage correction.
3. Otherwise an AI estimate grounded on the adverts we hold for the variant and related performance models, floored at
   the standard-model figure, with a range of at least -20%/+30%.
4. It refuses only when the AI estimate fails too.
A rare variant is never priced from standard-model adverts. The display rules (`cheapRange.ts`) are unchanged.

Imports (`_shared/importCheck.ts`): "likely" only when DVSA's manufactureDate is 2+ years before the first UK
registration, or the model was never sold new in the UK (JDM list); "possible" only for a Q plate. The plate's
letters/numbers are never used to infer age: a cherished or transferred plate (T80GOU on a 2016 Corsa, GB51DLB on a
2012 Smart) doesn't match the registration date and is not a sign of an import (fixed 2026-11-09 after both were
wrongly flagged "possible import"). analyse-vehicle gets the DVSA build year as `manufactureYear` from the lookup.
Imports get a wider range, confidence capped at Low, and a report note.
We don't apply an import premium or discount because we hold too few import-labelled adverts to measure one.

Data: the box harvester (collect_fresh.mjs) has targeted model feeds for rare, performance and JDM models (GT_RARE).
