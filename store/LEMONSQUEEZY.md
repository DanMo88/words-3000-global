# Selling Premium on the web with Lemon Squeezy — Daniel's steps

The app is ready. Payments stay **off** until you do the steps below. Until then the paywall shows "Coming soon" and nobody can pay.

**What is already built:**
- the paywall ("Buy once · $5") opens the Lemon Squeezy checkout with the buyer's account id and email filled in;
- the `lemonsqueezy-webhook` Edge Function:
  - checks the signature on every webhook;
  - sets Premium (lifetime) when an order is paid;
  - removes Premium on a refund;
- the one-phone lock: one active device per account, which can be moved once every 30 days;
- the terms and privacy pages, already updated.

**Lemon Squeezy is the merchant of record.** It sells to the customer, collects EU VAT and other sales taxes, issues receipts and handles chargebacks. You get payouts. Fees are about 5% + 50¢ per order, so roughly $0.75 on a $5 sale. Check https://www.lemonsqueezy.com/pricing.

---

## 1. Create the account and the store (≈10 min)
1. Go to https://app.lemonsqueezy.com/register and sign up with **mozafar.nl@gmail.com**. Confirm the email.
2. Create a store:
   - Store name: e.g. **3000 Words**.
   - Store URL (subdomain): e.g. `3000words` gives `3000words.lemonsqueezy.com`.
   - Currency: **USD**.
3. The store starts in **Test mode** (switch at the bottom left). Do steps 2–4 in test mode first.

## 2. Create the product "$5 lifetime"
1. Go to **Store → Products → + New product**.
2. Name: **3000 Words Premium (lifetime)**.
3. Description: "One-time purchase. Unlocks all lessons in all levels and all future language courses of English 3000 Words. One phone at a time; move it to a new phone once every 30 days."
4. Pricing: **Single payment**, **$5.00**. Tax category: **Software / SaaS** (or "eBooks / e-learning" if offered).
5. Under **Confirmation modal / Receipt**:
   - Button link: `https://danmo88.github.io/words-3000-global/`
   - Button text: "Open the app"
6. Publish the product.
7. Open the product → **Share** and copy the **checkout link**. It looks like `https://3000words.lemonsqueezy.com/buy/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`.
   → **Send me this link.** I put it into `LS.checkoutUrl` in app.js; that is the switch that turns on the Buy button.

## 3. Store id and variant id (optional extra safety)
- **Store id:** Settings → Stores. It is the number shown next to the store (e.g. `#123456`).
- **Variant id:** after the first test purchase I can read it from the order. You can also find it in Products → the product → the variant (the number in the URL).
- If you give me both, I set them as Edge Function secrets `LEMONSQUEEZY_STORE_ID` and `LEMONSQUEEZY_VARIANT_ID`. Orders for any other product or store are then ignored.

## 4. Webhook (this is what unlocks Premium)
1. Go to **Settings → Webhooks → + (Add webhook)**.
2. Callback URL: `https://acwkuhudvmarssthibzf.supabase.co/functions/v1/lemonsqueezy-webhook`
3. Signing secret: a random string of 6–40 characters.
   - For example, open https://www.random.org/strings/?num=1&len=32&digits=on&upperalpha=on&loweralpha=on&unique=on&format=html&rnd=new and copy the result.
   - Keep it private.
4. Events: tick **order_created** and **order_refunded**. Nothing else is needed.
5. Save.
6. Put the same secret into Supabase. Pick one of these:
   - **a) Yourself (preferred):**
     - https://supabase.com/dashboard/project/acwkuhudvmarssthibzf/functions/secrets → **Add new secret**
     - Name `LEMONSQUEEZY_SIGNING_SECRET`, value = the secret.
     - Nothing else is needed.
   - **b) Give it to me privately.** I store it in the server-only table `app_secrets`, which only the server can read. I never put it in the code or on GitHub.
7. Webhooks are separate for test mode and live mode. When you go live (step 6), add the same webhook again in **live mode** with the same URL, secret and events.

## 5. Test purchase (test mode, no real money)
1. Once I have put the test checkout link into the app, sign in to the app with a test account and open lesson 6 → **Buy once · $5**.
2. Pay with the test card **4242 4242 4242 4242**, any future date, any CVC.
3. Within a few seconds the app shows "Premium is active ✓".
4. In Lemon Squeezy, refund the order (Orders → order → Refund). Premium is removed on the next app check (within 10 minutes, or right away with "Check again").

## 6. Go live: activate the store, verify identity, payouts
1. Click **Activate your store** in the sidebar.
   - Fill in the short questionnaire. What you sell: "a language-learning web app; one-time purchase unlocks all lessons (digital content, fulfilled in the app)".
   - Website: `https://danmo88.github.io/words-3000-global/`
   - Terms: `https://danmo88.github.io/words-3000-global/terms.html`
   - Privacy: `https://danmo88.github.io/words-3000-global/privacy.html`
2. **Verify your identity:** Settings → General → *Verify your identity*. You need your passport or Dutch ID card and a selfie. Approval usually takes 1–3 business days.
3. **Payouts:** Settings → Payouts.
   - Add your **bank account (IBAN)** or a verified PayPal.
   - Fill in the **W-8BEN tax form**: you are a non-US individual living in the Netherlands.
   - Payouts happen twice a month, and only once at least $50 is due.
   - Dutch tax: this is income for you. Ask your accountant whether to register at the KVK or declare it as "resultaat uit overige werkzaamheden". Lemon Squeezy has already paid the VAT.
4. When the store is approved, open the product menu → **Copy to Live Mode**. Copy the **live** checkout link and send it to me (step 2.7), and add the live webhook (step 4.7).

## What I need from you
| What | Where you find it | Needed for |
|---|---|---|
| Checkout link (test first, live later) | Product → Share | Turning on the Buy button |
| Webhook signing secret | You choose it in step 4 | Set it yourself in Supabase secrets (4.6a), or give it to me |
| Store id, variant id (optional) | Settings → Stores; product variant | Ignoring other products |
| "Store approved" message | Email from Lemon Squeezy | Switching to the live link |

## Notes
- **Refund policy:** the terms promise a **full refund within 14 days, no questions asked**. This is more than EU law requires for digital content once access has started. If you want a different policy, tell me and I will change terms.html.
- **Lost phone:** the app allows one device move per 30 days. In a support case I can reset `profiles.device_moved_at` for that user.
- **Honest limit:** lesson files are public static files on GitHub Pages. The device check stops normal users, but a technical person could read the files directly. Real server-side gating would need the lessons to be served through Supabase. That is possible later.

---

# راهنمای کوتاه فارسی

۱. **ساخت حساب:**
   - در https://app.lemonsqueezy.com/register با mozafar.nl@gmail.com ثبت‌نام کن.
   - یک فروشگاه بساز (مثلاً 3000words) با واحد پول USD. فروشگاه اول در «حالت تست» است.
۲. **محصول:**
   - Products → New product، با نام «3000 Words Premium (lifetime)»، «Single payment» و قیمت **۵ دلار**.
   - منتشرش کن و از Share **لینک checkout** را کپی کن و برای من بفرست.
۳. **(اختیاری) شناسه‌ها:** Store id را از Settings → Stores و Variant id را از صفحه‌ی محصول بفرست. اگر نفرستی، خودم از اولین سفارش تستی برمی‌دارم.
۴. **وبهوک:**
   - در Settings → Webhooks، آدرس `https://acwkuhudvmarssthibzf.supabase.co/functions/v1/lemonsqueezy-webhook` را بگذار.
   - یک رمز تصادفی ۶ تا ۴۰ حرفی به‌عنوان Signing secret بساز.
   - رویدادهای **order_created** و **order_refunded** را تیک بزن.
   - همان رمز را خودت در Supabase → Edge Functions → Secrets با نام `LEMONSQUEEZY_SIGNING_SECRET` بگذار، یا خصوصی به من بده. هیچ‌وقت در کد یا گیت‌هاب نمی‌رود.
۵. **خرید تستی:** با کارت 4242 4242 4242 4242 بخر؛ چند ثانیه بعد پریمیوم فعال می‌شود. با Refund پریمیوم برداشته می‌شود.
۶. **فعال‌سازی واقعی:**
   - دکمه‌ی Activate your store را بزن و پرسشنامه را پر کن.
   - هویتت را با پاسپورت یا کارت شناسایی تأیید کن (۱ تا ۳ روز کاری).
   - در Settings → Payouts حساب بانکی (IBAN) یا PayPal و فرم مالیاتی **W-8BEN** را پر کن. پرداخت ماهی دو بار انجام می‌شود، از ۵۰ دلار به بالا.
   - بعد از تأیید، محصول را با Copy to Live Mode به حالت واقعی ببر.
   - لینک checkout واقعی را برایم بفرست و وبهوک را در حالت واقعی هم اضافه کن.
۷. **سیاست بازپرداخت:** در شرایط استفاده نوشته‌ام «تا ۱۴ روز بازپرداخت کامل بدون پرسش». اگر سیاست دیگری می‌خواهی بگو.
