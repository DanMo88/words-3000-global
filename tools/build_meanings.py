"""Build data/meanings/<lang>/<LEVEL>.json from tools/translations.tsv (id<TAB>fr<TAB>ar).
Run from the repo root: python3 tools/build_meanings.py. Also reports meaning clashes inside a lesson."""
import json, re
LANGS = ['fr', 'ar']
rows = [l.rstrip('\n').split('\t') for l in open('tools/translations.tsv', encoding='utf-8') if l.strip() and not l.startswith('#')]
tr = {r[0]: r[1:] for r in rows}
toks = lambda s: {t.strip() for t in re.split(r'[،؛,;]', re.sub(r'\(.*?\)', '', s)) if t.strip()}
for k, lang in enumerate(LANGS):
    for lv in ['A1', 'A2', 'B1', 'B2']:
        d = json.load(open(f'data/{lv}.json'))
        m = {i: tr[i][k] for L in d['lessons'] for i, *_ in L if i in tr}
        json.dump(m, open(f'data/meanings/{lang}/{lv}.json', 'w'), ensure_ascii=False, separators=(',', ':'))
        for li, L in enumerate(d['lessons']):
            ms = [(i, m[i]) for i, *_ in L if i in m]
            for a in range(len(ms)):
                for b in range(a + 1, len(ms)):
                    if toks(ms[a][1]) & toks(ms[b][1]): print('clash', lang, lv, li + 1, ms[a], ms[b])
        print(lang, lv, len(m))
