# Google Play preparation (Phase 3) — nothing has been uploaded

## What is here
- `listings/<locale>.md` — title (≤30), short (≤80) and full (≤4000) descriptions: en-US, fa-IR, ar, es-ES, de-DE, ru-RU, tr-TR, pt-BR (lengths checked).
- `screenshots/<lang>/` — phone screenshots 1080×1920 (9:16) for fa, ar, es, de, ru, tr: home, learning card, quiz, lessons. Regenerate: `node words-3000-global-test/storeshots.js <BASE> store/screenshots fa,ar,es,de,ru,tr`.
- `feature-graphic-1024x500.png` (+ `feature-graphic.html` source). App icon for Play: `../icons/icon-512.png`.
- `../.well-known/assetlinks.json` — Digital Asset Links TEMPLATE (see step 3).
- `../manifest.webmanifest` — id, scope, start_url, maskable icons (checked: content inside the safe zone), screenshots.

## What Daniel must do / supply later
1. **Google Play developer account** (one-time US$25) and the app's **package name** (suggested: `io.github.danmo88.words3000`; it can never change).
2. **Build the Android app (TWA)** with Bubblewrap (`npm i -g @bubblewrap/cli`):
   `bubblewrap init --manifest=https://danmo88.github.io/words-3000-global/manifest.webmanifest`
   - In `twa-manifest.json` set `"features": { "playBilling": { "enabled": true } }` (needed for the Digital Goods API) and keep `"enableNotifications": true`.
   - `bubblewrap build` → upload the `.aab` to an internal-testing track first.
3. **Digital Asset Links** (removes the browser bar in the app; required for Play Billing in a TWA):
   - Copy the SHA-256 of the *App signing key* from Play Console → Setup → App integrity into `assetlinks.json`, together with the package name.
   - IMPORTANT: Android looks for it at the **origin root**: `https://danmo88.github.io/.well-known/assetlinks.json`. A project site (`/words-3000-global/`) cannot serve that path. Either create the repo **`DanMo88/danmo88.github.io`** and put the file there (with an empty `.nojekyll`), or move the app to a custom domain.
4. **Subscription product** in Play Console → Monetize → Subscriptions: product id **`premium_monthly`**, one auto-renewing base plan, 1 month, **US$4.00** (Play converts to local prices).
5. **Server verification** (Supabase Edge Function `verify-purchase`, deployed but disabled):
   - Google Cloud: create a service account, create a JSON key; enable the *Google Play Android Developer API*.
   - Play Console → Users and permissions: invite the service-account email with *View financial data* and *Manage orders and subscriptions*.
   - Supabase dashboard → Edge Functions → Secrets: `PLAY_VERIFY_ENABLED=true`, `PLAY_PACKAGE_NAME=<package>`, `GOOGLE_SERVICE_ACCOUNT_JSON=<whole JSON key>`. Never commit the key.
   - Until this is done the app shows "Payments aren't switched on yet" in the Android app, and "available in the Android app" on the web.
   - Optional later: Real-time developer notifications (Pub/Sub) for instant renew/cancel updates; today premium is re-verified each time the Android app opens (`premium_until` + 3 days grace).
6. **Privacy policy URL** for the Play listing: `https://danmo88.github.io/words-3000-global/privacy.html`; **account deletion URL**: `https://danmo88.github.io/words-3000-global/delete-account.html`. Replace the placeholder contact email in `privacy.html` and `terms.html` first.
7. **Data safety form** (Play Console): collected = email, name, app activity (learning progress), purchase history (subscription status); not shared; encrypted in transit; users can request deletion; no ads.
8. **Content rating** questionnaire and target audience (general audience; not designed for children).

## Daily reminder — what it can and can't do
- Web/PWA: the reminder time is stored on the device. Where the browser supports Notification Triggers, real notifications are scheduled for the next 7 days; otherwise (most browsers today) the app shows a reminder banner when opened after the chosen time on a day without a lesson.
- Reliable notifications at an exact time need the Android app with native scheduling, or Web Push (e.g. Firebase Cloud Messaging, free) plus a scheduler — not set up, by choice.
