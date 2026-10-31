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

## Phase 2 — accounts and sync (Supabase) — DONE & LIVE (commit 16de3f9, SW cache w3g-v11), awaiting Daniel's review
- [x] 4. (B) Email sign up / sign in with password + forgot password (reset link → "new password" screen). Redirects go to APP_URL (GitHub Pages URL)
- [~] 5. (B) Google sign-in: UI + code done, hidden behind `SB.google = false` in app.js until Daniel creates the Google OAuth client and enables the provider in Supabase (steps below)
- [x] 6. Guest mode: everything works without an account; 👤 button in the header (orange dot when a guest has progress) + "save my progress" button on the lesson-done screen; on sign-in/sign-up local progress is merged and uploaded
- [x] 7. (B) Per-course sync: on sign-in, on app open, 4 s after every save, when going back online, when the app is hidden. Merge = union of words (newer copy per word wins, earliest learnedAt kept), union of lessons, streak from the latest day (consecutive days chain), best60 max, newest placement. Offline-safe (pending flag + retry)
- [x] 8. (B) Delete account in the app (confirm screen → Edge Function delete-account; local progress stays on the device) + public delete-account.html (in-app steps, sign-in-and-delete, request form → table deletion_requests, handled within 30 days)
- [x] 9. Profile: avatar letter, editable name, email, sync status, each language with words/streak/60-s record, sign out (syncs first; clears local courses — but keeps them if the session had expired), delete account
- Header: if the install label doesn't fit next to the title + 🔥 + 👤 + ⚙️, the install button becomes icon-only (fitHead)
- Daniel must do (Supabase dashboard): Auth → URL Configuration: Site URL = https://danmo88.github.io/words-3000-global/ and add it to Redirect URLs; custom SMTP (default mailer only sends to project team members, only a few emails per hour); Google provider (client ID/secret from Google Cloud, redirect URI https://acwkuhudvmarssthibzf.supabase.co/auth/v1/callback), then set SB.google = true
- Tests: words-3000-global-test/accounts.js (30 checks against the real project with 2 SQL-seeded disposable users; both are deleted by the test itself — in-app delete and delete page), render31.js now also covers sign-up/sign-in/reset/new-password/profile/pending/delete-confirm in all 31 languages

## Phase 3 — before Google Play — DONE (pending Daniel's review; no Play upload)
- [x] 10. (B) Billing plumbing: Digital Goods API + Payment Request (feature-detected, only inside the Android TWA); web shows "available in the Android app" and takes no payments. Product id `premium_monthly`, $4/month. Edge Function `verify-purchase` (source in supabase/functions/) validates the Play token with a Google service account and sets profiles.premium/premium_until server-side only; DISABLED (501) until Daniel sets the secrets (store/README.md step 5). Table play_purchases (server-written, user can read own). Premium re-verified on every app open in the TWA.
- [x] 11. Paywall after the free lessons: `FREE = { lessons: 5, per: 'app' }` in app.js (switch per → 'level' later). Counts completed lessons across all courses (per account when signed in, per device as guest); completed lessons stay open; 💎 on lessons that need Premium. Paywall: price, 4 features, subscribe / restore, privacy + terms links; guests are sent to sign-up first (premium is tied to the account). Premium flag only counts with an account.
- [x] 12. privacy.html + terms.html (English + Persian), contact email mozafar.nl@gmail.com (set 2026-10-31). Linked from settings, profile, paywall, delete-account page.
- [x] 13. TWA prep: manifest (id/scope/maskable checked, screenshots field, prefer_related_applications=false), store/listings (en-US, fa-IR, ar, es-ES, de-DE, ru-RU, tr-TR, pt-BR; limits checked), store/screenshots 1080×1920 for fa/ar/es/de/ru/tr, feature graphic 1024×500, .well-known/assetlinks.json template (must be served at https://danmo88.github.io/.well-known/ → needs repo DanMo88/danmo88.github.io or a custom domain). Steps in store/README.md.
- [x] 14. Daily reminder in settings (switch + time, stored on device only). Notification Triggers where supported (next 7 days scheduled via the SW); otherwise an in-app banner when the app is opened after that time on a day without a lesson. Exact-time notifications need the Android app or Web Push (not set up).
- Strings: tools/ui_phase3.txt (29 keys × 31 languages) → merge_ui_block.py → build_ui.py; fonts rebuilt, GLYPHS OK.
- Tests: words-3000-global-test/paywall.js (4 sizes × fa/de/ar/ru + real accounts: simulated TWA purchase → verify-purchase 501, server-side premium, expiry, reminder, legal pages); render31 now covers paywall (guest/signed-in/premium), premium profile, reminder settings and banner; test.js checks the paywall on lesson 11.

## Phase 2 — work log (started 2026-10-31 09:20)
- Supabase project: words-3000-global, ref acwkuhudvmarssthibzf, eu-central-1, org DanMo88 (free plan, $0). URL https://acwkuhudvmarssthibzf.supabase.co ; frontend key = publishable key (sb_publishable_…, safe to commit). NEVER commit the service role key.
- Migrations: accounts_and_progress (profiles, progress, RLS, column grants so premium is read-only, handle_new_user trigger), drop_delete_rpc (deletion moved to Edge Function to satisfy advisor 0029)
- Edge Function delete-account (verify_jwt) deletes the caller via admin API (cascade removes rows)
- supabase-js 2.118.0 UMD vendored as vendor/supabase-2.118.0.js (npm copy in /workspace/w3g-acct)
- Test users: cannot sign up @example.com (rejected) and default SMTP only mails team members → tests seed a confirmed disposable user via SQL, then delete it.
- Security advisors (security + performance): 0 findings after dropping the RPC.
- Fixed during testing: profile re-render loop when a stored session is invalid; sign-out no longer wipes local progress if the session had expired; header overflow in de/ru/ro/pt/es/af/bg/el/nl with the new 👤 button; RTL course name clipped at 768 px.
- Live check 2026-10-31 (390x844): accounts.js 30/0, render31 806 checks/0 fails; test users deleted, deletion_requests emptied. Persian screenshots: words-3000-global-test/phase2acct/{1-sign-in,2-profile,3-delete-confirm}.png

# Web purchase (Lemon Squeezy, one-time $5) + one-device lock — started 2026-10-31 11:45 (Daniel's new direction; Play Billing kept dormant)
- [x] DB migration web_purchase_and_device_lock: purchases (order_id pk, user_id, email, status, amount, currency, variant_id, test_mode), devices (one active per user via partial unique index), profiles.device_moved_at, app_secrets (service-role only). Clients: select own rows only, no writes.
- [x] Edge Function lemonsqueezy-webhook (verify_jwt=false, HMAC X-Signature; secret from env LEMONSQUEEZY_SIGNING_SECRET or app_secrets row; 501 until set). order_created paid → premium lifetime; order_refunded → revoked; idempotent.
- [x] Edge Function premium-device (verify_jwt=true): registers device, first device auto-active, claim = move (max once / 30 days, 429 move_limit), links unlinked paid orders by email.
- [ ] client: paywall "$5 once" + Lemon Squeezy checkout config (empty → coming soon), device screen, manage device, restore
- [ ] strings 31 langs, legal pages, store/LEMONSQUEEZY.md, tests, live, screenshots
