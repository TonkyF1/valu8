"""Merge the seed dataset (base_listings.csv.gz) with harvested data (data/listings/listings.csv.gz)
into the listings.csv schema clean.py expects. Writes $WORK/listings.csv."""
import csv, gzip, os, re, sys
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
WORK = os.environ.get('WORK', '/tmp/owncomps')
os.makedirs(WORK, exist_ok=True)
CAT_RX = re.compile(r"\bcat(?:egory)?[\s.:-]+[snbcd]\b(?![\w-])|\binsurance (?:write[- ]?off|loss)\b|\bwritten[- ]off\b|\brecorded (?:as )?(?:damage|write[- ]?off)\b|\bhpi (?:marker|flagged)\b", re.I)
NEG_RX = re.compile(r"\b(?:not|no|never|non|isn.t|is not|never been)\s+(?:an?\s+)?(?:a\s+)?(?:cat(?:egory)?|recorded|insurance|written|write)", re.I)
def is_cat(t):
    """Explicit write-off phrases only; ignores negations like 'not cat', 'no cat', 'never been written off'."""
    for m in CAT_RX.finditer(t):
        pre = t[max(0, m.start() - 25):m.end()]
        if NEG_RX.search(pre): continue
        return True
    return False
def flags(t):
    t = t.lower()
    return dict(cat_sn=is_cat(t),
      non_runner=bool(re.search(r'non[- ]?runner|spares (or|and|/) repair|not running|won.t start|doesn.t start|engine (fault|problem|issue)|gearbox (fault|problem|issue)|needs (a )?(new )?(clutch|engine|gearbox|turbo)|dpf (issue|problem)|turbo (issue|problem)|breaking', t)),
      no_mot=bool(re.search(r'no mot|mot expired|without mot|mot ran out', t)),
      long_mot=bool(re.search(r'(12|11|10|full|fresh|new|long) ?(months?)? ?mot|mot (until|till|to|expires?) (\w+ )?2027', t)),
      fsh=bool(re.search(r'\bfsh\b|full (service|dealer) history|fdsh', t)))
import base64, io
HERE = os.path.dirname(os.path.abspath(__file__))
def open_gz(p):
    # Files pushed via text-only tooling may be stored as base64 (*.gz.b64).
    if os.path.exists(p): return gzip.open(p, 'rt')
    if os.path.exists(p + '.b64'): return io.TextIOWrapper(gzip.GzipFile(fileobj=io.BytesIO(base64.b64decode(open(p + '.b64').read()))), encoding='utf-8')
    return None
# --- seller cues / make normalisation (mirror of scripts/harvest/collect.mjs dealerCue/normMake) ---
CUE_STRIP = [re.compile(r"\b(no|not|without)\s+(\w+\s+){0,2}(warranty|finance|part[\s-]*ex\w*|p/?x)\b", re.I),
             re.compile(r"\b(battery|clutch|gearbox|tyres?|parts?|acuator|actuator|repair)\b[^.]{0,30}warranty", re.I)]
CUE_STRONG = [re.compile(p, f) for p, f in [
    (r"\bfinance\s+(is\s+)?(available|options|arranged|packages)\b", re.I), (r"\btrade\s+sale\b", re.I),
    (r"\b(visit|see)\s+our\s+(website|showroom|forecourt|stock)\b", re.I), (r"\bour\s+(showroom|forecourt|dealership)\b", re.I),
    (r"\b(cliff\s+warranty|warranty\s*first|warrantywise|autoprotect)\b", re.I), (r"\bpart[\s-]*exchange\s+(vehicle|car)\s+to\s+clear\b", re.I),
    (r"\b(ltd|car\s+sales)\b(?!\s+edition)", re.I), (r"\b[A-Z][A-Za-z-]+\s+(Motors|Car Sales|Autos|Automotive|Motor Group|Car Centre)\b", 0),
    (r"\bwarranty\s+(included|provided|given)\b", re.I), (r"\b\d+\s*(months?|mths?)\s+warranty\b(?!\s+(on|with|from|for)\b)", re.I)]]
CUE_WEAK = [re.compile(p, re.I) for p in [r"\b(part[\s-]*ex(change)?|partex|p/?x)\s+(welcome|available|considered)\b", r"\bdelivery\s+available\b",
    r"\bwarranty\b", r"\bhpi\s+clear\s*\|", r"\bvosa\s+verified\b"]]
def dealer_cue(t):
    d = t or ''
    for r in CUE_STRIP: d = r.sub(' ', d)
    return any(r.search(d) for r in CUE_STRONG) or sum(bool(r.search(d)) for r in CUE_WEAK) >= 2
MAKE_FIX = {'mg': 'MG', 'mg motor uk': 'MG', 'mg motor': 'MG', 'mg motors': 'MG', 'bmw': 'BMW', 'ds': 'DS', 'ds automobiles': 'DS', 'cupra': 'CUPRA',
    'vw': 'Volkswagen', 'mercedes': 'Mercedes-Benz', 'mercedes benz': 'Mercedes-Benz', 'mercedes-benz': 'Mercedes-Benz', 'land rover': 'Land Rover', 'alfa romeo': 'Alfa Romeo', 'mini': 'Mini'}
def norm_make(m):
    k = ' '.join((m or '').split()).lower()
    return MAKE_FIX.get(k, re.sub(r'\b\w', lambda c: c.group().upper(), k))
base = list(csv.DictReader(open_gz(os.path.join(HERE, 'base_listings.csv.gz'))))
for r in base:
    r['cat_sn'] = is_cat((r['variant'] or '') + ' ' + (r['desc'] or ''))
K = list(base[0].keys()); ids = {r['id'] for r in base}; rows = list(base); added = 0
hp = os.path.join(ROOT, 'data/listings/listings.csv.gz')
fh_h = open_gz(hp)
if fh_h:
    for r in csv.DictReader(fh_h):
        if r['status'] == 'duplicate': continue
        rid = {'gumtree': 'gt', 'ebay': 'eb'}.get(r['source'], r['source']) + r['listing_id']
        if rid in ids: continue
        ids.add(rid); added += 1
        sold = r['status'] == 'delisted' and r['sold_price_inferred']
        rows.append(dict(id=rid, source=r['source'], make=r['make'], model=r['model'], variant=r['trim'], year=r['year'], mileage=r['mileage'],
            fuel=r['fuel'], gearbox=r['gearbox'], seller=r['seller_type'], price=r['sold_price_inferred'] if sold else r['price'],
            price_type='inferred_sold' if sold else 'asking', search_tag='harvest', **flags(r['trim'] + ' ' + r['desc']),
            source_url=r['url'], date=r['last_seen'], desc=r['desc']))
relabelled = 0
for r in rows:
    r['make'] = norm_make(r['make'])
    if r['seller'] == 'private' and dealer_cue((r['variant'] or '') + ' ' + (r['desc'] or '')): r['seller'] = 'dealer'; relabelled += 1
print(f'seller relabelled private->dealer from text cues: {relabelled}')
PLATE = re.compile(r'\b[A-Z]{2}[0-9]{2} ?[A-Z]{3}\b', re.I)
for r in rows:
    r['variant'] = PLATE.sub('[reg]', r['variant'] or ''); r['desc'] = PLATE.sub('[reg]', r['desc'] or '')
with open(os.path.join(WORK, 'listings.csv'), 'w', newline='') as fh:
    w = csv.DictWriter(fh, K); w.writeheader(); w.writerows(rows)
print(f'base={len(base)} harvested_added={added} total={len(rows)}')
