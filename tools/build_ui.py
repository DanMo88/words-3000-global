"""Build i18n/<code>.json from tools/ui/<code>.txt (key|value lines; plural values are JSON objects).
Auto keys: _lang, _name, pagerPrev, pagerNext, seconds, fbWrong, percent. Validates against fa.json keys + placeholders."""
import json, re, sys, os
os.chdir(os.path.dirname(os.path.abspath(__file__)) + '/..')
langs = {l['code']: l for l in json.load(open('i18n/langs.json'))['languages']}
ref = json.load(open('i18n/fa.json'))
PCT = {'de': '{n} %', 'fr': '{n} %', 'cs': '{n} %', 'da': '{n} %', 'fi': '{n} %', 'nb': '{n} %', 'sv': '{n} %', 'sk': '{n} %', 'bg': '{n}%', 'tr': '%{n}', 'fa': '{n}٪', 'ar': '{n}٪', 'hu': '{n}%', 'el': '{n}%', 'ru': '{n} %', 'uk': '{n}%', 'pl': '{n}%', 'ro': '{n} %', 'hr': '{n} %', 'af': '{n}%', 'es': '{n} %', 'it': '{n}%', 'pt': '{n}%', 'nl': '{n}%'}
CATS = {'ar': {'zero', 'one', 'two', 'few', 'many', 'other'}, 'ru': {'one', 'few', 'many', 'other'}, 'uk': {'one', 'few', 'many', 'other'}, 'pl': {'one', 'few', 'many', 'other'},
        'cs': {'one', 'few', 'many', 'other'}, 'hr': {'one', 'few', 'other'}, 'ro': {'one', 'few', 'other'}, 'he': {'one', 'two', 'other'}}
NOPL = {'zh', 'ja', 'ko', 'th', 'vi', 'id', 'fa'}
PLURAL_KEYS = ['nLessons', 'nextDueDays', 'nWords', 'quickResult']
ph = lambda s: sorted(set(re.findall(r'\{(\w+)\}', s)))
def build(code):
    li = langs[code]; d = {}
    for ln in open(f'tools/ui/{code}.txt', encoding='utf-8'):
        ln = ln.rstrip('\n')
        if not ln.strip(): continue
        k, v = ln.split('|', 1)
        if v.startswith('{"'): v = json.loads(v)
        assert k not in d, (code, 'dup', k); d[k] = v
    rtl = li['dir'] == 'rtl'
    d.update({'_lang': code, '_name': li['name'], 'pagerPrev': '›' if rtl else '‹', 'pagerNext': '‹' if rtl else '›', 'seconds': '{n}″', 'fbWrong': '✗ '})
    d.setdefault('percent', PCT.get(code, '{n}%'))
    errs = []
    keys = set(ref) | {'search'}
    for k in keys - set(d): errs.append('missing ' + k)
    for k in set(d) - keys: errs.append('extra ' + k)
    for k, v in d.items():
        if k not in ref: continue
        rv = ref[k]; want = ph(rv if isinstance(rv, str) else rv.get('other', ''))
        vals = [v] if isinstance(v, str) else list(v.values())
        if isinstance(v, dict):
            need = CATS.get(code, set() if code in NOPL else {'one', 'other'}) | {'other'}
            if set(v) - need - {'zero'} and code not in ('ar',): errs.append(f'{k} extra cats {set(v) - need}')
            if need - set(v) and k != 'nextDueDays': errs.append(f'{k} missing cats {need - set(v)}')
        for x in vals:
            got = ph(x)
            if k in PLURAL_KEYS and isinstance(v, dict): continue
            if got != want: errs.append(f'{k} placeholders {got} != {want}')
        if any(not str(x).strip() for x in vals) and k not in ('fbWrong',): errs.append('empty ' + k)
    out = dict(sorted(d.items(), key=lambda kv: list(ref).index(kv[0]) if kv[0] in ref else 999))
    json.dump(out, open(f'i18n/{code}.json', 'w'), ensure_ascii=False, indent=1)
    return errs
codes = sys.argv[1:] or [c for c in langs if os.path.exists(f'tools/ui/{c}.txt')]
bad = 0
for c in codes:
    e = build(c); bad += len(e)
    print(c, 'OK' if not e else e)
sys.exit(1 if bad else 0)
