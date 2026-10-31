"""Phase-1 (courses) UI strings: merge tools/ui_courses.tsv into tools/ui/<code>.txt (and fa/ar/fr JSON, which have no .txt),
derive langEnglishUS from appSub, and write i18n/names.json (target-language names in every UI language, from CLDR via Node Intl)."""
import json, os, subprocess
os.chdir(os.path.dirname(os.path.abspath(__file__)) + '/..')
langs = [l['code'] for l in json.load(open('i18n/langs.json'))['languages']]
rows = [l.rstrip('\n').split('\t') for l in open('tools/ui_courses.tsv', encoding='utf-8') if l.strip()]
hdr, rows = rows[0][1:], {r[0]: r[1:] for r in rows[1:]}
assert set(rows) == set(langs), set(langs) ^ set(rows)
for c in langs:
    cur = json.load(open(f'i18n/{c}.json'))
    vals = dict(zip(hdr, rows[c]))
    vals['langEnglishUS'] = cur['appSub'].split(' · ')[0]
    if c == 'fr': vals = {k: v.replace(' ?', '\u00a0?').replace(' :', '\u00a0:') for k, v in vals.items()}
    txt = f'tools/ui/{c}.txt'
    if os.path.exists(txt):
        lines = [l for l in open(txt, encoding='utf-8').read().split('\n') if l.strip() and l.split('|', 1)[0] not in vals]
        lines += [f'{k}|{v}' for k, v in vals.items()]
        open(txt, 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
    else:
        cur.update(vals); json.dump(cur, open(f'i18n/{c}.json', 'w'), ensure_ascii=False, indent=1)
# CLDR language names (target list); small fixes where CLDR is awkward
js = r"""
const L = JSON.parse(process.argv[1]); const out = {};
for (const ui of L) { const dn = new Intl.DisplayNames([ui], { type: 'language' }); out[ui] = {};
  for (const c of L) { let n = dn.of(c === 'nb' ? 'no' : c); out[ui][c] = n.charAt(0).toLocaleUpperCase(ui) + n.slice(1); } }
console.log(JSON.stringify(out));"""
names = json.loads(subprocess.check_output(['node', '-e', js, json.dumps(langs)]))
FIX = {('fa', 'hr'): 'کرواتی', ('fa', 'tr'): 'ترکی'}
for (ui, c), v in FIX.items(): names[ui][c] = v
json.dump(names, open('i18n/names.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print('ok', len(langs), 'langs')
