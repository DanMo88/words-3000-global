"""After a language's meanings validate: enable it in langs.json, bump data/index.json version, record in tools/p2/DONE.txt.
Usage: python3 tools/p2/finish_lang.py de   (then commit + push)"""
import json, sys, os
lang = sys.argv[1]; R = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(R))
L = json.load(open(f'{ROOT}/i18n/langs.json'))
for l in L['languages']:
    if l['code'] == lang: l['meanings'] = ['A1', 'A2', 'B1', 'B2']
json.dump(L, open(f'{ROOT}/i18n/langs.json', 'w'), ensure_ascii=False, indent=1)
ix = json.load(open(f'{ROOT}/data/index.json')); ix['version'] = ix.get('version', 1) + 1
json.dump(ix, open(f'{ROOT}/data/index.json', 'w'), ensure_ascii=False, separators=(',', ':'))
n = sum(len(json.load(open(f'{ROOT}/data/meanings/{lang}/{lv}.json'))) for lv in ['A1', 'A2', 'B1', 'B2'])
done = [x.split()[0] for x in open(f'{R}/DONE.txt')] if os.path.exists(f'{R}/DONE.txt') else []
if lang not in done:
    open(f'{R}/DONE.txt', 'a').write(f'{lang} {n}\n')
print(lang, n, 'index version', ix['version'])
