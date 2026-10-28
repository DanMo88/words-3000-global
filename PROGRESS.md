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
- [x] final live re-test (3,023 checks, 0 fails) + screenshots in /workspace/words-3000-global-test/final
## Status: SAMPLE DONE — waiting for Daniel's feedback (next: more languages / full fr+ar meanings / Play Store build)

# 31 LANGUAGES (task from 2026-10-28 21:12)
## Phase 1 (UI + flags + fonts + picker)
- [x] i18n/langs.json: 31 languages (flags/…svg, aliases); Persian = flags/ir-lion-sun.svg (Wikimedia "State flag of Iran (1964–1980)"), Arabic = flags/arab.svg (Arab League), Portuguese = Brazil flag; others from flag-icons 7.6 (MIT)
- [x] tools/ui/<code>.txt → tools/build_ui.py → i18n/<code>.json (129 keys incl. "search"); fa/ar/fr edited directly as JSON
- [x] fonts: tools/build_fonts.py → fonts/w3g-{latin,hebrew,thai,deva}.woff2 + w3g-fonts.css (unicode-range); CJK = system fonts. RERUN after Phase 2 meanings!
- [x] app.js: flag list + search picker, aliases guessLang, CJK-aware toks/fit, placement guard
- [x] WIP commit ac3146a; render31 all 31 × 4 sizes found header/level-name overflow on 390/412 (nl ro bg da es pt de el)
- [x] Fix commit 6803a2e (style.css v3, app.js v4 long-name threshold >7, cache w3g-v4); render31 ×4 sizes 0 fails
- [x] full test.js reps re-run after fixes: 22,004 checks, 0 fails (p1run/f{1,2,3}.log)
- [x] screenshots script words-3000-global-test/shots1.js → phase1/ (local OK); PHASE1_DONE.md written
- [ ] push to GitHub (blocked by an auto-review classifier error on 2026-10-28 ~23:20) → live 390x844 check (shots1.js on live URL)
## Phase 1 status: DONE locally; awaiting push + live check
## Phase 2 (meanings for all 2,973 words × 31 langs) — NOT STARTED (only kaikki downloads exist)
- kaikki per-word downloads: /workspace/w3g-mt/kaikki/<id>.json (fetch.py, log fetch.log)
