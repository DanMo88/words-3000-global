"""Subset bundled fonts to the characters actually used (UI strings, language names, word meanings).
Writes fonts/w3g-*.woff2 and fonts/w3g-fonts.css (with unicode-range so each file loads only when needed).
CJK uses the phone's system fonts (Noto CJK / PingFang / Hiragino / Apple SD Gothic / YaHei)."""
import json, glob, os
from fontTools.ttLib import TTFont
from fontTools import subset
from fontTools.varLib import instancer
SRC = '/workspace/w3g-mt/fontsrc'
FONTS = [('w3g-latin', 'W3G Latin', 'NotoSans.ttf'), ('w3g-hebrew', 'W3G Hebrew', 'NotoSansHebrew.ttf'),
         ('w3g-thai', 'W3G Thai', 'NotoSansThai.ttf'), ('w3g-deva', 'W3G Deva', 'NotoSansDeva.ttf')]
text = set()
def walk(o):
    if isinstance(o, str): text.update(o)
    elif isinstance(o, dict): [walk(v) for v in o.values()]; [walk(k) for k in o.keys()]
    elif isinstance(o, list): [walk(v) for v in o]
for f in glob.glob('i18n/*.json') + glob.glob('data/meanings/*/*.json'): walk(json.load(open(f)))
for f in glob.glob('data/[AB]*.json'): walk(json.load(open(f)))
PRIV = os.environ.get('W3G_PRIVATE')   # private full copy (premium meanings are not in this repo): REQUIRED so premium words never miss glyphs
if not PRIV: raise SystemExit('set W3G_PRIVATE=/path/to/private/full-copy (premium meanings live outside the repo)')
for f in glob.glob(PRIV + '/data/meanings/*/*.json') + glob.glob(PRIV + '/data/[AB]*.json'): walk(json.load(open(f)))
text.update(chr(c) for c in range(0x20, 0x7f)); text.update(chr(c) for c in list(range(0xA0, 0x250)) + list(range(0x400, 0x460)));  # full Latin-1/Ext-A/B + basic Cyrillic so new meanings never miss glyphs
text.update('–—‘’“”„«»…·•′″%‰№°×÷+−±')
def ranges(cps):
    cps = sorted(cps); out = []; s = p = cps[0]
    for c in cps[1:]:
        if c == p + 1: p = c; continue
        out.append((s, p)); s = p = c
    out.append((s, p))
    return ', '.join(f'U+{a:X}' if a == b else f'U+{a:X}-{b:X}' for a, b in out)
css = []
for fn, fam, src in FONTS:
    f = TTFont(f'{SRC}/{src}')
    if 'fvar' in f: f = instancer.instantiateVariableFont(f, {'wdth': 100, 'wght': (400, 900)} if any(a.axisTag == 'wght' for a in f['fvar'].axes) else {'wdth': 100})
    f.save('/tmp/_inst.ttf'); f = TTFont('/tmp/_inst.ttf', lazy=False)
    cmap = f.getBestCmap()
    cps = {ord(ch) for ch in text if ord(ch) in cmap}
    if fn != 'w3g-latin': cps = {c for c in cps if c > 0x24F or c in (0x20,)} | {0x20}
    opt = subset.Options(); opt.flavor = 'woff2'; opt.layout_features = ['*']; opt.name_IDs = ['*']; opt.notdef_outline = True
    sub = subset.Subsetter(opt); sub.populate(unicodes=cps); sub.subset(f)
    f.flavor = 'woff2'; f.save(f'fonts/{fn}.woff2')
    rng = ranges(cps if fn == 'w3g-latin' else {c for c in cps if c != 0x20})
    css.append(f"@font-face{{font-family:'{fam}';src:url({fn}.woff2) format('woff2');font-weight:400 900;font-display:swap;unicode-range:{rng}}}")
    print(fn, len(cps), 'glyph cps', os.path.getsize(f'fonts/{fn}.woff2'), 'bytes')
open('fonts/w3g-fonts.css', 'w').write('\n'.join(css) + '\n')
