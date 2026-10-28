#!/usr/bin/env bash
# Weekly: rebuild ownCompsData.ts from seed + harvested listings, re-run the held-out evaluation and only
# replace supabase/functions/_shared/ownCompsData.ts when held-out median error does not get worse than
# the last accepted run (scripts/owncomps/last_eval.json). Exit 0 either way; prints ACCEPTED/REJECTED.
set -euo pipefail
cd "$(dirname "$0")/../.."
export WORK="${WORK:-$(mktemp -d)}"
python3 scripts/owncomps/build_listings.py
python3 scripts/owncomps/clean.py
deno run -A scripts/owncomps/gen.ts
deno run -A scripts/owncomps/eval.ts > /dev/null
# Live comps may have been built from a larger local collection than the repo's data/listings; never
# replace them with a much smaller build.
export CUR_ROWS="$(deno eval --no-lock 'import { OWN_COMPS_ROWS as r } from "./supabase/functions/_shared/ownCompsData.ts"; console.log(String(r.length))' 2>/dev/null || echo 0)"
python3 - <<'PY'
import json, os, shutil
W = os.environ['WORK']; new = json.load(open(f'{W}/eval.json'))
lp = 'scripts/owncomps/last_eval.json'
old = json.load(open(lp)) if os.path.exists(lp) else None
print('before:', json.dumps(old and {k: old[k] for k in ('overall', 'under5kPrivate')}))
print('after :', json.dumps({k: new[k] for k in ('overall', 'under5kPrivate')}))
cur = int(os.environ.get('CUR_ROWS') or 0)
if new['trainRows'] < 0.9 * cur:
    print(f"REJECTED: new build has {new['trainRows']} rows vs {cur} live; ownCompsData.ts unchanged")
elif old is None or new['overall']['median'] <= old['overall']['median']:
    shutil.copy(f'{W}/ownCompsData.ts', 'supabase/functions/_shared/ownCompsData.ts')
    json.dump(new, open(lp, 'w'), indent=1)
    print('ACCEPTED')
else:
    print('REJECTED: held-out median got worse; ownCompsData.ts unchanged')
PY
