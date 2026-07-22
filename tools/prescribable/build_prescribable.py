#!/usr/bin/env python3
"""Prescribable model v3 = v2 + plausibility layer + option-B strength suppression.

 - Swaps resolved by PHARMACOLOGY (learned per-molecule strength distributions),
   not source-trust -> correctly fixes cases where a "trusted" source had the swap.
 - A strength is VERIFIED iff: >=2 sources agree, OR single-molecule & plausible,
   OR (single-source combo) the molecule->strength assignment is plausibility-
   UNAMBIGUOUS (any swap would be implausible).
 - Unverified strengths are SUPPRESSED (values nulled, molecules kept) and marked
   strength_status='unverified' for pharmacist/reference confirmation.
"""
import json, re, hashlib, csv
from collections import defaultdict, Counter
from itertools import permutations
import xlsxwriter

SRC = r"D:\Dev\Projects\aushadhi\data-drops\2026-07-20\drugs.jsonl"
OUT_JSONL = r"D:\Dev\Projects\aushadhi\data-drops\2026-07-20\prescribable.jsonl"
OUT_XLSX = r"D:\Dev\Projects\aushadhi\data-drops\2026-07-20\Aushadhi-Prescribable-Compendium-2026-07-20.xlsx"
OUT_CSV = r"D:\Dev\Projects\aushadhi\data-drops\2026-07-20\strength-conflicts-2026-07-20.csv"
OUT_REVIEW = r"D:\Dev\Projects\aushadhi\data-drops\2026-07-20\strength-review-shortlist-2026-07-20.csv"
RELEASE = "2026-07-20"

DROP = set("""tablet tablets tab tabs capsule capsules cap caps strip strips of in a an the
bottle bottles syrup syrups injection injections inj vial vials ml mg mcg gm g kg iu
dry oral suspension powder for solution drops drop cream gel ointment lotion sachet
sachets tube tubes respules rotacap piece pieces pack packs kit s""".split())
UNITISH = re.compile(r'^\d+(\.\d+)?(mg|mcg|g|gm|ml|iu|%|)$')
RELEASE_WORD = re.compile(r'release', re.I)
FORM_PATTERNS = [('Injection', r'injection|infusion|\binj\b|\bvial\b|ampoule'),
    ('Inhalation', r'inhaler|rotacap|respule|inhalation'), ('Nasal/Spray', r'nasal spray|\bspray\b'),
    ('Drops', r'eye drop|ear drop|nasal drop|\bdrops?\b'), ('Topical', r'cream|ointment|\bgel\b|lotion|\bsoap\b'),
    ('Oral Liquid', r'syrup|suspension|elixir|\bsolution\b|\bliquid\b'), ('Powder/Sachet', r'\bpowder\b|\bsachet\b'),
    ('Capsule', r'capsule|\bcaps?\b'), ('Tablet', r'tablet|\btabs?\b|\bdt\b')]
SRC_PREF = {'onemg-live': 0, 'github-jr': 1, 'netmeds': 2, 'pharmeasy': 3, 'apollo': 4}


def brand_core(bn):
    t = re.sub(r'[^a-z0-9]+', ' ', (bn or '').lower()).split()
    return ''.join(x for x in t if not (x.isdigit() or UNITISH.match(x) or x in DROP))


def norm_form(brand, fr, pack):
    fr = '' if (fr and RELEASE_WORD.search(fr)) else (fr or '')
    text = ' '.join(filter(None, [brand or '', pack or '', fr])).lower()
    for lbl, pat in FORM_PATTERNS:
        if re.search(pat, text):
            return lbl
    return 'Other'


def sig_of(ings):
    return tuple(sorted((((i.get('molecule') or '').lower().strip(),
        round(i['strength_value'], 3) if isinstance(i.get('strength_value'), (int, float)) and not isinstance(i.get('strength_value'), bool) else None,
        (i.get('strength_unit') or '').lower()) for i in ings), key=lambda x: (x[0], x[1] is None, x[1] or 0, x[2])))


def pack_num(pl):
    m = re.search(r'\d+', pl or '')
    return int(m.group()) if m else None


def fmt(v):
    return str(int(v)) if isinstance(v, (int, float)) and float(v).is_integer() else str(v)


def comp_str(sig):
    return ' + '.join(f"{m} {fmt(rv)}{u}".strip() if rv is not None else m for (m, rv, u) in sig)


def vmulti(sig):
    return tuple(sorted(((rv, u) for (_, rv, u) in sig), key=lambda x: (x[0] is None, x[0] or 0, x[1])))


# ---------- PASS 1: molecule distributions + conflict groups ----------
molcount, moltotal = defaultdict(Counter), Counter()
groups = defaultdict(lambda: defaultdict(set))
sample = {}
with open(SRC, encoding='utf-8') as fh:
    for line in fh:
        line = line.strip()
        if not line:
            continue
        try:
            r = json.loads(line)
        except Exception:
            continue
        ings = r.get('ingredients') or []
        for i in ings:
            m = (i.get('molecule') or '').lower().strip()
            v = i.get('strength_value')
            u = (i.get('strength_unit') or '').lower()
            if m and isinstance(v, (int, float)) and not isinstance(v, bool):
                molcount[m][(round(v, 3), u)] += 1
                moltotal[m] += 1
        sig = sig_of(ings)
        names = frozenset(m for (m, _, _) in sig if m)
        if not names:
            continue
        ck = (brand_core(r.get('brand_name')), norm_form(r.get('brand_name'), r.get('form_raw'), r.get('pack_label')), names, pack_num(r.get('pack_label')))
        groups[ck][sig].add(((r.get('sources') or [{}])[0]).get('source'))
        sample.setdefault(ck, r.get('brand_name'))


def is_plausible(m, v, u):
    if v is None:
        return True
    n = molcount[m].get((round(v, 3), u), 0)
    return n >= 3 and n / max(1, moltotal[m]) >= 0.005


def plaus_score(sig):
    return sum((molcount[m].get((v, u), 0) / max(1, moltotal[m])) for (m, v, u) in sig if v is not None)


def assignment_unambiguous(mols):
    # mols: list of dicts with molecule/strength_value/strength_unit
    if any(m['strength_value'] is None for m in mols):
        return False
    names = [(m['molecule'] or '').lower() for m in mols]
    vals = [(round(m['strength_value'], 3), (m['strength_unit'] or '').lower()) for m in mols]
    base = dict(zip(names, vals))
    if not all(is_plausible(n, v, u) for n, (v, u) in base.items()):
        return False
    if len(mols) > 3:
        return False  # too many combinations to certify -> treat as unverifiable
    for perm in set(permutations(vals)):
        cand = dict(zip(names, perm))
        if cand == base:
            continue
        if all(is_plausible(n, v, u) for n, (v, u) in cand.items()):
            return False   # an alternative assignment is also plausible -> ambiguous
    return True


# ---------- resolve conflicts (plausibility) + build review CSV ----------
resolution = {}
csv_rows = []
review_rows = []
for ck, sig_src in groups.items():
    if len(set().union(*sig_src.values())) < 2 or len(sig_src) < 2:
        continue
    per_src = defaultdict(set)
    for sig, srcs in sig_src.items():
        for s in srcs:
            per_src[s].add(sig)
    if len({frozenset(v) for v in per_src.values()}) < 2:
        continue
    _, _, names, _ = ck
    sigs = list(sig_src)
    is_swap = (len(names) >= 2 and len({vmulti(s) for s in sigs}) == 1)
    cons = max(sigs, key=plaus_score)          # PLAUSIBILITY, not source-trust
    # REVIEW: a non-swap cross-source disagreement where NO option is fully plausible
    # -> plausibility can't decide; needs a human / authoritative reference.
    any_plausible = any(all(is_plausible(m, v, u) for (m, v, u) in s) for s in sigs)
    review = (not is_swap) and not any_plausible
    resolution[ck] = {'swap': is_swap, 'cons': cons,
                      'cons_map': {m: (v, u) for (m, v, u) in cons}, 'review': review}
    if review:
        review_rows.append({'brand_sample': sample[ck], 'molecules': ' + '.join(sorted(names)),
                            'form': ck[1], 'pack': ck[3], 'n_sources': len(set().union(*sig_src.values())),
                            'competing_strengths': ' ; '.join(f"{comp_str(s)} [{','.join(sorted(sr))}]" for s, sr in sig_src.items())})
    others = [(s, srcs) for s, srcs in sig_src.items() if s != cons]
    csv_rows.append({'_r': (0 if is_swap else 1, -len(sig_src)),
        'conflict_type': 'swap' if is_swap else 'value/scale',
        'resolution': 'plausibility->' + comp_str(cons),
        'brand_sample': sample[ck], 'molecules': ' + '.join(sorted(names)),
        'consensus_sources': ','.join(sorted(sig_src[cons])),
        'rejected': ' ; '.join(f"{comp_str(s)} [{','.join(sr)}]" for s, sr in others)})
csv_rows.sort(key=lambda r: r.pop('_r'))
with open(OUT_CSV, 'w', newline='', encoding='utf-8-sig') as fh:
    w = csv.DictWriter(fh, fieldnames=list(csv_rows[0].keys()))
    w.writeheader(); w.writerows(csv_rows)
review_rows.sort(key=lambda r: -r['n_sources'])
if review_rows:
    with open(OUT_REVIEW, 'w', newline='', encoding='utf-8-sig') as fh:
        w = csv.DictWriter(fh, fieldnames=list(review_rows[0].keys()))
        w.writeheader(); w.writerows(review_rows)


# ---------- PASS 2: merge with repair ----------
def strength_tokens(ings):
    return {fmt(i['strength_value']) for i in ings if isinstance(i.get('strength_value'), (int, float)) and not isinstance(i.get('strength_value'), bool)}


def pick_display(names, stoks):
    def score(n):
        s, low = 0.0, n.lower()
        if re.search(r'strip of|in strip|bottle of|in a strip|vial of|tube of| of ', low):
            s += 100
        if re.search(r'\b(strip|bottle|vial|sachet|packet|tube)\b', low):
            s += 20
        if n.isupper():
            s += 40
        if stoks:
            s += 30 * sum(1 for t in stoks if t not in low)
        return s + len(n) / 500.0
    return min(names, key=score)


def pick_maker(makers):
    c = Counter(m for m in makers if m)
    return max(c.items(), key=lambda kv: (kv[1], not kv[0].isupper(), len(kv[0])))[0] if c else None


def best_ings(rows):
    return sorted(rows, key=lambda x: (SRC_PREF.get(x['source'], 9), -sum(1 for i in x['ings'] if i.get('strength_raw'))))[0]['ings']


def comp_display(ings):
    return ' + '.join((f"{(i.get('molecule') or '').title()} {i.get('strength_raw')}".strip() if i.get('strength_raw') else (i.get('molecule') or '').title()) for i in ings)


presc = defaultdict(list)
resolved_flag = defaultdict(bool)
review_flag = defaultdict(bool)
N = 0
with open(SRC, encoding='utf-8') as fh:
    for line in fh:
        line = line.strip()
        if not line:
            continue
        try:
            r = json.loads(line)
        except Exception:
            continue
        N += 1
        ings = [dict(i) for i in (r.get('ingredients') or [])]
        form = norm_form(r.get('brand_name'), r.get('form_raw'), r.get('pack_label'))
        bc = brand_core(r.get('brand_name'))
        names = frozenset((i.get('molecule') or '').lower().strip() for i in ings if i.get('molecule'))
        ck = (bc, form, names, pack_num(r.get('pack_label')))
        res = resolution.get(ck)
        sig = sig_of(ings)
        if res and res['swap'] and sig != res['cons']:
            for i in ings:
                m = (i.get('molecule') or '').lower().strip()
                if m in res['cons_map']:
                    v, u = res['cons_map'][m]
                    i['strength_value'], i['strength_unit'] = v, u
                    i['strength_raw'] = (f"{fmt(v)}{u}" if v is not None else None)
            sig = res['cons']
        src = ((r.get('sources') or [{}])[0])
        pkey = (bc, form, sig)
        presc[pkey].append({'brand': r.get('brand_name'), 'maker': r.get('manufacturer'), 'type': r.get('type'),
            'form': form, 'pack': r.get('pack_label'), 'price': r.get('price_inr'), 'disc': r.get('is_discontinued'),
            'atc': tuple(r.get('atc_codes') or []), 'ings': ings, 'source': src.get('source'),
            'source_id': src.get('source_id'), 'seen': src.get('seen_at'), 'first': r.get('first_seen'), 'last': r.get('last_seen')})
        if res and res['swap']:
            resolved_flag[pkey] = True
        if res and res.get('review'):
            review_flag[pkey] = True


def med_id(pkey):
    bc, form, sig = pkey
    return hashlib.sha1(f"{bc}|{form}|{sig}".encode()).hexdigest()[:12]


records = []
st_counter = Counter()
for pkey, rows in presc.items():
    ings = best_ings(rows)
    names = [x['brand'] for x in rows if x['brand']]
    dv = [x['disc'] for x in rows]
    disc = False if any(v is False for v in dv) else (True if any(v is True for v in dv) else None)
    prices = [x['price'] for x in rows if isinstance(x['price'], (int, float)) and not isinstance(x['price'], bool)]
    sources = sorted({x['source'] for x in rows if x['source']})
    seen_pv, pvs = set(), []
    for x in rows:
        s = (x['source'], x['source_id'], x['pack'])
        if s in seen_pv:
            continue
        seen_pv.add(s)
        pvs.append({'pack_label': x['pack'], 'price_inr': x['price'], 'source': x['source'], 'source_id': x['source_id'], 'seen_at': x['seen']})
    types = [x['type'] for x in rows if x['type']]
    molecules = [{'molecule': i.get('molecule'), 'strength_value': i.get('strength_value'),
                  'strength_unit': i.get('strength_unit'), 'strength_raw': i.get('strength_raw')} for i in ings]

    # ---- verification status (option B) ----
    have_strength = any(m['strength_value'] is not None for m in molecules)
    if not have_strength:
        status = 'no_strength'
    elif resolved_flag[pkey]:
        status = 'resolved_by_plausibility'      # a swap was corrected; multi-source; show + advise verify
    elif len(sources) >= 2:
        status = 'verified'                       # >=2 sources independently agree
    elif len(molecules) == 1:
        m = molecules[0]
        status = 'verified' if is_plausible((m['molecule'] or '').lower(), m['strength_value'], (m['strength_unit'] or '').lower()) else 'unverified'
    else:
        status = 'verified' if assignment_unambiguous(molecules) else 'unverified'

    note = None
    if status == 'unverified':
        note = 'strength unverified (single source, ambiguous assignment) — confirm before clinical use'
        for m in molecules:                       # OPTION B: suppress the strength
            m['strength_value'] = None
            m['strength_unit'] = None
            m['strength_raw'] = None
    elif status == 'resolved_by_plausibility':
        note = 'strength assignment auto-resolved by pharmacological plausibility — verify'
    st_counter[status] += 1

    records.append({'med_id': med_id(pkey), 'display_name': pick_display(names, strength_tokens(ings)) if names else None,
        'form': pkey[1], 'molecules': molecules,
        'composition_display': (' + '.join((m['molecule'] or '').title() for m in molecules) if status == 'unverified' else comp_display(ings)),
        'manufacturer': pick_maker([x['maker'] for x in rows]), 'brand_aliases': sorted(set(names)),
        'type': 'allopathy' if 'allopathy' in types else (types[0] if types else None),
        'atc_codes': sorted({c for x in rows for c in x['atc']}), 'is_discontinued': disc,
        'strength_status': status, 'strength_verified': status in ('verified', 'resolved_by_plausibility'),
        'strength_conflict': bool(review_flag[pkey]),
        'strength_note': (note or 'sources disagree on strength & plausibility cannot decide — needs authoritative review') if review_flag[pkey] else note,
        'source_count': len(sources), 'sources': sources,
        'price_inr_min': min(prices) if prices else None, 'price_inr_max': max(prices) if prices else None,
        'pack_count': len(pvs), 'pack_variants': pvs,
        'first_seen': min([x['first'] for x in rows if x['first']], default=None),
        'last_seen': max([x['last'] for x in rows if x['last']], default=None)})

records.sort(key=lambda r: (r['display_name'] or '').lower())
with open(OUT_JSONL, 'w', encoding='utf-8') as fh:
    for rec in records:
        fh.write(json.dumps(rec, ensure_ascii=False) + '\n')

G = len(records)
print(f"input records ...................... {N:,}")
print(f"prescribable medicines ............. {G:,}")
print(f"conflict groups (CSV) .............. {len(csv_rows):,}")
print("strength_status:")
for k, v in st_counter.most_common():
    print(f"  {k:<26} {v:>8,}  ({100*v/G:.1f}%)")
sup = st_counter['unverified']
n_review = sum(1 for r in records if r['strength_conflict'])
print(f"\nOPTION B: {sup:,} records had strength SUPPRESSED ({100*sup/G:.1f}% of catalogue)")
print(f"REVIEW SHORTLIST: {n_review:,} records flagged strength_conflict (-> {OUT_REVIEW.split(chr(92))[-1]})")

# ---------- Excel ----------
wb = xlsxwriter.Workbook(OUT_XLSX, {'constant_memory': True})
f_title = wb.add_format({'bold': True, 'font_size': 15, 'font_color': '#1F3864'})
f_sub = wb.add_format({'italic': True, 'font_color': '#555'})
f_sec = wb.add_format({'bold': True, 'font_color': '#FFF', 'bg_color': '#2E5496'})
f_hdr = wb.add_format({'bold': True, 'bg_color': '#D9E1F2', 'border': 1})
f_lbl = wb.add_format({'bold': True})
f_int = wb.add_format({'num_format': '#,##0'})
ws = wb.add_worksheet('Summary')
ws.set_column(0, 0, 44); ws.set_column(1, 2, 15)
row = 0
ws.merge_range(0, 0, 0, 2, f"Aushadhi Prescribable Compendium v3 — {RELEASE}", f_title); row = 2
ws.write(row, 0, "plausibility-resolved · option-B strength suppression for unverifiable combos", f_sub); row += 2
def sec(t):
    global row
    ws.merge_range(row, 0, row, 2, t, f_sec); row += 1
def kv(l, n):
    global row
    ws.write(row, 0, l, f_lbl); ws.write_number(row, 1, n, f_int); ws.write_number(row, 2, n / G, wb.add_format({'num_format': '0.0%'})); row += 1
sec('Model'); kv('Input source-union records', N); kv('Prescribable medicines', G); kv('Dispensing packs preserved', sum(r['pack_count'] for r in records)); row += 1
sec('Strength verification (option B)')
for k, v in st_counter.most_common():
    kv(k, v)
P_HDR = ['med_id', 'display_name', 'form', 'composition_display', 'strength_status', 'strength_verified', 'strength_conflict', 'strength_note',
         'manufacturer', 'source_count', 'sources', 'pack_count', 'pack_labels', 'price_min', 'price_max', 'is_discontinued', 'atc_codes']
P_W = [13, 32, 12, 40, 22, 9, 9, 46, 30, 8, 22, 8, 38, 9, 9, 12, 24]
ps = wb.add_worksheet('Prescribable')
for c, w in enumerate(P_W):
    ps.set_column(c, c, w)
ps.freeze_panes(1, 0); ps.autofilter(0, 0, G, len(P_HDR) - 1)
for c, h in enumerate(P_HDR):
    ps.write(0, c, h, f_hdr)
for i, r in enumerate(records, 1):
    packs = ' | '.join(sorted({(pv['pack_label'] or '') for pv in r['pack_variants'] if pv['pack_label']}))
    ps.write_row(i, 0, [r['med_id'], r['display_name'], r['form'], r['composition_display'], r['strength_status'],
        'YES' if r['strength_verified'] else 'NO', 'REVIEW' if r['strength_conflict'] else '', r['strength_note'], r['manufacturer'], r['source_count'],
        ' | '.join(r['sources']), r['pack_count'], packs, r['price_inr_min'], r['price_inr_max'],
        ('Discontinued' if r['is_discontinued'] is True else 'Active' if r['is_discontinued'] is False else 'Unknown'), ' | '.join(r['atc_codes'])])
ks = wb.add_worksheet('Packs')
for c, w in enumerate([13, 32, 12, 34, 10, 12, 16, 12]):
    ks.set_column(c, c, w)
ks.freeze_panes(1, 0)
for c, h in enumerate(['med_id', 'display_name', 'form', 'pack_label', 'price_inr', 'source', 'source_id', 'seen_at']):
    ks.write(0, c, h, f_hdr)
kr = 0
for r in records:
    for pv in r['pack_variants']:
        kr += 1
        ks.write_row(kr, 0, [r['med_id'], r['display_name'], r['form'], pv['pack_label'], pv['price_inr'], pv['source'], pv['source_id'], pv['seen_at']])
ks.autofilter(0, 0, kr, 7)
wb.close()
print(f"WROTE {OUT_JSONL}\nWROTE {OUT_XLSX} (Prescribable={G:,}, Packs={kr:,})\nWROTE {OUT_CSV}")
