# Phase 1 DONE — 31 native languages (UI + flags + fonts + picker)

Commits: ac3146a (31-language WIP), 6803a2e (layout fixes, style.css?v=3, app.js?v=4, SW cache w3g-v4), + docs.

## What's in
- 31 native languages = Mondly's native list minus English: af ar bg zh hr cs da nl fi fr de el he hi hu id it ja ko nb fa pl pt ro ru es sv th tr uk vi
- i18n/<code>.json (129 keys each, same key set as fa; no empty values); i18n/langs.json with flags + search aliases
- Flags: flags/*.svg (flag-icons 7.6, MIT). Persian = flags/ir-lion-sun.svg (lion-and-sun), Arabic = flags/arab.svg (Arab League), Portuguese = Brazil
- Fonts: Vazirmatn (fa/ar) + subset w3g-{latin,hebrew,thai,deva}.woff2; CJK/Korean use phone system fonts. tools/check_glyphs.py → GLYPHS OK
- Searchable flag picker (native + English names + aliases), settings language switch, RTL for fa/ar/he

## Tests (local, Playwright, 360x640 / 375x667 / 390x844 / 412x915)
- test.js reps fa ar he zh ja hi th ru de: 12,092 + 4,956 + 4,956 = 22,004 checks, 0 fails (logs: words-3000-global-test/p1run/f{1,2,3}.log)
- render31.js all 31 langs × 4 sizes: 310 checks per size, 0 fails (p1run/R-*.log, Rro-*.log)
- Found & fixed: header (install/streak/gear) pushed off-screen and level names clipped on tall phones for nl ro bg da es pt de el
  (dvh-scaled fonts now capped by vw; long-name stacking threshold >7 letters; ro title slightly smaller)

## Screenshots (390x844): words-3000-global-test/phase1/
picker-top, picker-scrolled, picker-search, persian-card-lion-sun (+ persian-card-context, ir-lion-sun-flag-zoom), home-zh, home-hi, home-he, home-th, settings-th

## Caveats
- Word meanings exist only for fa (all 2,973) and fr/ar (130 sample words); other 28 languages show the "translation coming soon" toast on lessons → Phase 2
- All non-Persian UI strings are machine-authored, not reviewed by native speakers
- CJK/Korean glyph rendering depends on the phone's system fonts (fine on Android/iOS; not bundled)
- Re-run tools/build_fonts.py after Phase 2 meanings (subsets cover UI text only)
