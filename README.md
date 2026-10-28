# English 3000 Words — multilingual sample

Proposed store name: **English 3000 Words** (short: **3000 Words**).
Mobile web app (PWA) for learning the Oxford 3000 words (CEFR A1–B2) in American English, 10 words per lesson,
with the interface and word meanings in the learner's own language. Made for Daniel Mozafari.

Native languages in this sample: Persian (fa, RTL, all 2,973 words), Arabic (ar, RTL) and French (fr, LTR) — first 10 A1 lessons + 1 lesson of A2/B1/B2 translated.

## Add a language
1. `i18n/<code>.json` — copy `i18n/fa.json` and translate every value (plural forms may be objects: `{"one": "...", "other": "..."}`).
2. `data/meanings/<code>/<LEVEL>.json` — `{ "<word id>": "<meaning>" }`. Lessons without all meanings show "translation coming soon".
3. Add an entry to `i18n/langs.json` (`code`, own-script `name`, `en`, `dir`, number locale `num`, `pick` = "Choose your language").

## Paywall-ready
`ACCESS` in `app.js` (`paywall:false`, `freeLessons:5`, `isPremium()`, `paywallScreen()`) is the single hook for the planned Google Play subscription.

- Word list & levels: The Oxford 3000™ by CEFR level (Oxford University Press), adapted to American English.
- Audio: Microsoft Edge neural voice en-US-JennyNeural.
- Pictures: AI illustrations (Lesson 1) and Noto Emoji by Google (Apache License 2.0).
