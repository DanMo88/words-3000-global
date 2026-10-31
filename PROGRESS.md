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
- [x] pushed 5143ddd; live serves w3g-v4; live 390x844: render31 all 31 langs 310 checks 0 fails (render31-live.js, p1run/live-r31-*.log), test.js he+zh 826 checks 0 fails; live screenshots in words-3000-global-test/phase1/
## Phase 1 status: DONE (live)
## Phase 2 (meanings for all 2,973 words × 31 langs) — NOT STARTED (only kaikki downloads exist)
- kaikki per-word downloads: /workspace/w3g-mt/kaikki/<id>.json (fetch.py, log fetch.log)

## Phase 2: word meanings (2,973 words per language)

Done (all 4 levels enabled in i18n/langs.json; see tools/p2/DONE.txt): fa, de, fr, es, ar, ru, tr, it, nl, pl, da, nb, pt, uk, sv, zh, ja, ko, hi, he, el, af, bg, hr, cs, fi, hu, id, ro, th, vi
Phase 2 complete for all 31 languages. SW cache is w3g-v9; bump it when shipping further data/UI changes.
Notes: ro build converts cedilla ş/ţ to comma-below ș/ț (build_lang.py); vi uses the uk-style Wiktionary base (Google dict mostly unranked for vi); th needed ~820 manual overrides (Google th picks often archaic/wrong).
Remaining: none
Notes (zh/ja/ko/hi/he/el): build_lang SCRIPT for ja now allows 々 (U+3005). Latin acronyms (T-shirt, IT, Wi-Fi, email) are spelled out in the native script, since script: checks flag Latin letters. he keeps Google's niqqud where it gave it; the overrides are unpointed. CJK uses system fonts; deva/hebrew subsets keep all layout features.
Note (uk-style languages): if a language's Google dict dumps have all scores = 0 (unranked, alphabetical), the auto pick is poor; build the base from Wiktionary first-sense translations in /workspace/w3g-mt/kaikki/<id>.json (code = L), reranked by the Google entries, write it as L.tsv and review (see tools/p2/uk.tsv header).

How to resume for language L:
1. Fetch dictionary dumps: `python3 /workspace/w3g-mt/gfetch2.py L` (writes /workspace/w3g-mt/gdict/L/<id>.json, skips existing).
2. Build: `python3 tools/p2/build_lang.py L` (must report BAD 0). Overrides go in tools/p2/L.tsv (id TAB meaning).
3. Review: `python3 tools/p2/lowconf.py L` and `python3 tools/p2/lowconf.py L 0 2000 --hi`; `tools/p2/show.py L hard|fn|rand`. Fix into L.tsv, rebuild.
4. Fonts: `python3 tools/build_fonts.py` then `python3 tools/check_glyphs.py` (GLYPHS OK).
5. `python3 tools/p2/finish_lang.py L` (enables levels, bumps data/index.json version, logs DONE.txt), then commit and push.
Never commit a language's data/meanings/L before it has been reviewed (restore with `git checkout -- data/meanings/L`).
Caveat: meanings are machine-dictionary based with manual review, not native-speaker checked. Arabic verbs are mostly past-tense citation form (the 130 original samples use present tense).

# Pre-publish plan (approved by Daniel 2026-10-31: build phases 1–3 on GitHub; Google Play packaging later; sample-first, stop for review after each phase)
Legend: [x] done · [~] in progress · [ ] todo · (B) = needs backend (Supabase)

## Phase 1 — target language + several languages at once — DONE locally, awaiting Daniel's review
- [x] 1. After the native language: "Which language do you want to learn?" — 31 tiles (American English + 30 others, native excluded), flags (fa = lion-and-sun, en = flags/us.svg), nothing preselected, Continue disabled until a choice
- [x] 2. Languages without content show the localized "Coming soon" badge (`soon` key); tapping shows a short note (`comingSoonMsg`) and can't start
- [x] 3. Home: course bar under the header (current flag + name ▾ → "My languages" switcher; "➕ New language" → add-language screen). Progress, streak, review queue, hard words, 60-s record, placement stored per target language
- Storage: localStorage `w3g-v2` = {v, lang, cur, courses:{<target>:{words,lessons,streak,best60,placement,onboarded,added}}}; old `w3g-v1` migrated into courses.en once and kept untouched as a backup. Premium flag lives at R.premium (account level). Add a target course = add it to `COURSES` in app.js + its content.
- Strings: tools/ui_courses.tsv → `python3 tools/add_course_ui.py` (merges into tools/ui/*.txt + fa/ar/fr JSON, writes i18n/names.json from CLDR) → `python3 tools/build_ui.py`; then build_fonts + check_glyphs (now also checks names.json)
- Tests: words-3000-global-test/courses.js (onboarding, switcher, per-course separation, migration), render31.js (now incl. target screen, switcher, "recommended" badge on every level), test.js (target step added)
- Also fixed: "⭐ recommended" line on a level card overflowed horizontally in ru/el at 390/412 px (pre-existing on live)

## Phase 2 — accounts and sync (Supabase) — TODO
- [ ] 4. (B) Sign up / sign in with email
- [ ] 5. (B) Sign in with Google
- [ ] 6. Guest mode: start without an account, later attach progress to a new account
- [ ] 7. (B) Cross-device progress sync (per course)
- [ ] 8. (B) Delete account in the app + public web page for deletion requests (Google Play requirement)
- [ ] 9. Profile screen: name, languages, stats, sign out

## Phase 3 — before Google Play — TODO
- [ ] 10. (B) $4/month subscription via Google Play Billing (server-side purchase verification)
- [ ] 11. Paywall screen after the free lessons (open: 5 free lessons for the whole app or per level?)
- [ ] 12. Privacy policy + terms pages
- [ ] 13. Android package (TWA) assets: icon, screenshots, store texts in several languages (packaging/upload later)
- [ ] 14. Daily reminder notification at a chosen time
