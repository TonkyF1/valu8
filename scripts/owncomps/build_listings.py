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
PLATE = re.compile(r'\b[A-Z]{2}[0-9]{2} ?[A-Z]{3}\b', re.I)
for r in rows:
    r['variant'] = PLATE.sub('[reg]', r['variant'] or ''); r['desc'] = PLATE.sub('[reg]', r['desc'] or '')
with open(os.path.join(WORK, 'listings.csv'), 'w', newline='') as fh:
    w = csv.DictWriter(fh, K); w.writeheader(); w.writerows(rows)
print(f'base={len(base)} harvested_added={added} total={len(rows)}')
