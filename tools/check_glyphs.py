"""Tofu check: every character used in UI strings / language names / meanings must be covered
by a bundled font (Vazirmatn for fa/ar, W3G subsets for everything else) or be CJK/emoji that
phones render with system fonts."""
import json, glob, os, sys
from fontTools.ttLib import TTFont
cov = {}
for f in glob.glob('fonts/*.woff2'):
    cov[os.path.basename(f)] = set(TTFont(f).getBestCmap().keys())
viz = set().union(*[v for k, v in cov.items() if k.startswith('Vazirmatn')])
w3g = set().union(*[v for k, v in cov.items() if k.startswith('w3g-')])
def system_ok(cp):
    return (0x2E80 <= cp <= 0x9FFF or 0xAC00 <= cp <= 0xD7AF or 0x1100 <= cp <= 0x11FF or 0x3130 <= cp <= 0x318F
            or 0xF900 <= cp <= 0xFAFF or 0xFF00 <= cp <= 0xFFEF or cp >= 0x1F000 or 0x2190 <= cp <= 0x2BFF
            or cp in (0xFE0F, 0x200D, 0x200C, 0x200F, 0x200E, 0x2060) or 0x3000 <= cp <= 0x303F)
langs = json.load(open('i18n/langs.json'))['languages']
bad = {}
for l in langs:
    c = l['code']; texts = [l['name'], l['pick']]
    for v in json.load(open(f'i18n/{c}.json')).values():
        texts += list(v.values()) if isinstance(v, dict) else [v]
    PRIV = os.environ.get('W3G_PRIVATE', '')   # also check premium meanings (kept outside the repo)
    for f in glob.glob(f'data/meanings/{c}/*.json') + (glob.glob(f'{PRIV}/data/meanings/{c}/*.json') if PRIV else []):
        texts += list(json.load(open(f)).values())
    texts += list(json.load(open('i18n/names.json')).get(c, {}).values())
    fonts = viz | w3g if c in ('fa', 'ar') else w3g
    miss = sorted({ch for t in texts for ch in str(t) if ord(ch) > 32 and ord(ch) not in fonts and not system_ok(ord(ch))})
    if miss: bad[c] = ''.join(miss)
print('GLYPHS', 'OK' if not bad else bad)
sys.exit(1 if bad else 0)
