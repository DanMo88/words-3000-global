"""Build the free FAMILY version (repo DanMo88/words-3000-family → https://danmo88.github.io/words-3000-family/)
from this codebase. Nothing is edited by hand in the family repo: fix things here, then run

    python3 tools/build_family.py [/workspace/words-3000-family]

and commit + push the family repo. What the build does:
  * app.js: drops every block between //#paid-begin and //#paid-end (paywall, device lock, Lemon Squeezy, Play
    Billing, accounts/sync), turns on the /*#family-begin … #family-end*/ blocks (family code screen, family token,
    premium-content with the token) and sets FAMILY = true.
  * storage names w3g-… → w3f-… (localStorage, Cache Storage, service worker caches) so the paid app and the family app
    on the same phone (same origin danmo88.github.io) never share progress, tokens or caches.
  * i18n: drops purchase/account/device strings (prices, Premium, sign-in…), app name = "Words 3000 Family".
  * copies only public runtime files: the free data/audio/img that are already public in the paid repo.
    Paid lessons, meanings, audio and images are NOT in either repo: the family app downloads them from Supabase
    (premium-content) after the family code was accepted by the family-unlock Edge Function.
  * checks: no paid markers left, no price / Lemon Squeezy / Play strings, every t('key') exists, no paid-only media.
"""
import json, os, re, shutil, sys
SRC = os.path.dirname(os.path.abspath(__file__)) + '/..'
os.chdir(SRC)
DST = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '/workspace/words-3000-family')
NAME, PATH = 'Words 3000 Family', '/words-3000-family/'
COPY_DIRS = ['data', 'audio', 'img', 'flags', 'fonts', 'icons', 'i18n']
COPY_FILES = ['install.js', 'style.css', '.nojekyll']
DROP_KEY = re.compile(r'^(pw.*|dev.*|premium|privacy|terms|savePrompt|acct.*|signIn|signUp|email|password|nameLabel|forgotPw|googleBtn|guestContinue|reset.*|newPwSave|checkEmail|signedInMsg|errCreds|errEmail.*|errWeakPw|errNotConfirmed|errRate|synced.*|syncPending|signOut|deleteAcct|del[A-Z].*|deleted|save|cancel)$')
FORBID = re.compile(r'lemon|checkout|play\.google|getDigitalGoods|PaymentRequest|verify-purchase|premium-device|premium_monthly|\bUS\$|(?<!>)\$\s?[0-9]|[0-9]\s?\$|\bUSD\b|€|paywall', re.I)

def build_app(s):
    out, skip, n_paid, n_fam = [], False, 0, 0
    for ln in s.split('\n'):
        st = ln.strip()
        if st == '//#paid-begin': assert not skip; skip = True; n_paid += 1; continue
        if st == '//#paid-end': assert skip; skip = False; continue
        if st in ('/*#family-begin', '#family-end*/'): n_fam += st.startswith('/*'); continue
        if not skip: out.append(ln)
    assert not skip and n_paid >= 10 and n_fam >= 8, (n_paid, n_fam)
    s = '\n'.join(out)
    assert s.count('const FAMILY = false;') == 1; s = s.replace('const FAMILY = false;', 'const FAMILY = true; ')
    s = s.replace("'w3g-", "'w3f-")
    return s

def main():
    os.makedirs(DST, exist_ok=True)
    for d in COPY_DIRS:
        if os.path.exists(f'{DST}/{d}'): shutil.rmtree(f'{DST}/{d}')
        shutil.copytree(d, f'{DST}/{d}')
    for f in COPY_FILES: shutil.copy(f, f'{DST}/{f}')
    app = build_app(open('app.js', encoding='utf-8').read()); open(f'{DST}/app.js', 'w', encoding='utf-8').write(app)
    sw = open('sw.js', encoding='utf-8').read()
    sw = sw.replace("'w3g-", "'w3f-").replace("'w3g'", "'w3f'").replace(" 'vendor/supabase-2.118.0.js',", '')
    assert 'w3g-v' not in sw and 'vendor/' not in sw
    open(f'{DST}/sw.js', 'w', encoding='utf-8').write(sw)
    html = open('index.html', encoding='utf-8').read()
    html = html.replace('<title>English 3000 Words</title>', f'<title>{NAME}</title>').replace('content="3000 Words"', f'content="{NAME}"')
    html = html.replace('Learn the 3000 most important American English words (Oxford 3000, A1–B2) in your own language.', 'Family edition: the 3000 most important American English words (Oxford 3000, A1–B2) in your own language.')
    assert NAME in html and 'English 3000 Words' not in html
    open(f'{DST}/index.html', 'w', encoding='utf-8').write(html)
    m = json.load(open('manifest.webmanifest'))
    m.update({'id': PATH, 'start_url': PATH + '?source=pwa', 'scope': PATH, 'name': NAME, 'short_name': NAME,
              'description': 'Family edition: learn the 3000 most important American English words (Oxford 3000, A1–B2) in your own language.'})
    m.pop('screenshots', None)
    json.dump(m, open(f'{DST}/manifest.webmanifest', 'w'), ensure_ascii=False, indent=2)
    # i18n: no purchase / account strings, Latin app name
    langs = [l['code'] for l in json.load(open('i18n/langs.json'))['languages']]
    keys_used = set(re.findall(r"\bt\('([A-Za-z0-9_]+)'(?!\s*\+)", app)) | set(re.findall(r"\bsay\('([A-Za-z0-9_]+)'", app))
    keys_used -= {'acct', 'savePrompt'}   # only inside `FAMILY ? '' : …` / `!FAMILY && …` (never shown in this build)
    for c in langs:
        d = json.load(open(f'i18n/{c}.json', encoding='utf-8'))
        d = {k: v for k, v in d.items() if not DROP_KEY.match(k)}
        d['appName'] = NAME
        miss = [k for k in keys_used if k not in d]
        assert not miss, (c, miss)
        bad = [k for k, v in d.items() if FORBID.search(json.dumps(v, ensure_ascii=False))]
        assert not bad, (c, bad)
        json.dump(d, open(f'{DST}/i18n/{c}.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    # checks on code
    for f in ['app.js', 'sw.js', 'index.html', 'manifest.webmanifest', 'install.js']:
        txt = open(f'{DST}/{f}', encoding='utf-8').read()
        hit = FORBID.findall(txt); assert not hit, (f, hit[:5])
        assert '#paid' not in txt and '#family' not in txt, f
    # no paid-only media / lessons: family files must be a subset of the paid repo's public files
    for d in ['audio', 'img', 'data']:
        a = {os.path.relpath(os.path.join(r, x), f'{DST}/{d}') for r, _, fs in os.walk(f'{DST}/{d}') for x in fs}
        b = {os.path.relpath(os.path.join(r, x), d) for r, _, fs in os.walk(d) for x in fs}
        assert a == b, d
    for lv in ['A1', 'A2', 'B1', 'B2']:
        dd = json.load(open(f'{DST}/data/{lv}.json')); assert len(dd['lessons']) <= dd.get('free', 5), lv
    for x in ['privacy.html', 'terms.html', 'delete-account.html', 'vendor', 'store', 'supabase', 'tools']:
        p = f'{DST}/{x}'
        if os.path.isdir(p): shutil.rmtree(p)
        elif os.path.exists(p): os.remove(p)
    open(f'{DST}/README.md', 'w').write(f"""# {NAME}

Free family edition of [words-3000-global](https://github.com/DanMo88/words-3000-global): https://danmo88.github.io/words-3000-family/

**Generated — do not edit here.** Change the main repo, then run `python3 tools/build_family.py` there and commit this repo.

- On first open the app asks for a 4-digit family code. The code is checked only on the server
  (Supabase Edge Function `family-unlock`, bcrypt hash + rate limit); it is not in this repo.
- After the code, every lesson, meaning, audio and image is downloaded from Supabase and cached on the phone (works offline).
  This repo only contains the same free files that are public in the main app.
""")
    print('family build OK →', DST, '| paid blocks removed, i18n', len(langs), 'languages')
main()
