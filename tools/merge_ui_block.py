"""Merge a block file of new UI strings (sections '## <code>' followed by 'key|value' lines) into tools/ui/<code>.txt
(fa/ar/fr have no .txt: written straight into i18n/<code>.json). Run tools/build_ui.py afterwards.
Usage: python3 tools/merge_ui_block.py tools/ui_account.txt"""
import json, os, sys
os.chdir(os.path.dirname(os.path.abspath(__file__)) + '/..')
langs = [l['code'] for l in json.load(open('i18n/langs.json'))['languages']]
blocks, cur = {}, None
for ln in open(sys.argv[1], encoding='utf-8'):
    ln = ln.rstrip('\n')
    if ln.startswith('## '): cur = ln[3:].strip(); blocks[cur] = {}; continue
    if not ln.strip(): continue
    k, v = ln.split('|', 1); assert k not in blocks[cur], (cur, k); blocks[cur][k] = v
assert set(blocks) == set(langs), set(blocks) ^ set(langs)
keys = list(blocks['fa'])
for c, d in blocks.items(): assert list(d) == keys, (c, set(d) ^ set(keys))
for c in langs:
    vals = blocks[c]
    if c == 'fr': vals = {k: v.replace(' ?', '\u00a0?').replace(' :', '\u00a0:').replace(' !', '\u00a0!') for k, v in vals.items()}
    txt = f'tools/ui/{c}.txt'
    if os.path.exists(txt):
        lines = [l for l in open(txt, encoding='utf-8').read().split('\n') if l.strip() and l.split('|', 1)[0] not in vals]
        open(txt, 'w', encoding='utf-8').write('\n'.join(lines + [f'{k}|{v}' for k, v in vals.items()]) + '\n')
    else:
        d = json.load(open(f'i18n/{c}.json')); d.update(vals); json.dump(d, open(f'i18n/{c}.json', 'w'), ensure_ascii=False, indent=1)
print('merged', len(keys), 'keys into', len(langs), 'languages')
