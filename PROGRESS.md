# PROGRESS — words-3000-global (multilingual sample of english-words-3000)

Local: /workspace/words-3000-global · tests: /workspace/words-3000-global-test (test.js, shots/, runN.log)
Local server for tests: `cd /workspace && python3 -m http.server 18791 --bind 127.0.0.1` → http://127.0.0.1:18791/words-3000-global/
Original live app DanMo88/english-words-3000 is NOT touched (separate localStorage key w3g-v1, SW caches w3g-*).

## Done
- [x] Copied site, split meanings out of level data → data/meanings/<lang>/<LEVEL>.json (fa = all 2,973)
- [x] fr + ar meanings: A1 lessons 1–10 + first lesson of A2/B1/B2 = 130 words each (tools/translations.tsv, tools/build_meanings.py; no in-lesson clashes)
- [x] i18n/langs.json + i18n/{fa,ar,fr}.json (128 keys each, plural objects for ar/fr)
- [x] app.js i18n (t(), Intl numbers/plurals, picker, settings ⚙️, untranslated-lesson toast, ACCESS paywall hook off)
- [x] install.js i18n, style.css RTL/LTR fixes, manifest name "English 3000 Words"/"3000 Words"
- [x] Playwright run2: 12,092 checks, 0 fails (before 2 small fixes: fr nbsp before !?:, logo nowrap)
- [x] Local git commit 549fbfe
## Todo
- [x] run3 re-test after fixes: 12,092 checks, 0 fails
- [ ] gh repo create DanMo88/words-3000-global --public, push, enable Pages (main /)
- [ ] live smoke test + final screenshots (390x844) → report
- [x] Repo created + pushed, Pages live https://danmo88.github.io/words-3000-global/ ; live 390x844 run 3,023 checks 0 fails; SW + offline OK
- [x] Fix: toast cleared on screen change (app.js?v=2, cache w3g-v2)
- [ ] final live re-test + screenshots in /workspace/words-3000-global-test/final
