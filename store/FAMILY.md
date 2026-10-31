# Family edition — admin notes

**Link for the family:** https://danmo88.github.io/words-3000-family/ (repo DanMo88/words-3000-family, generated from this repo).

- Completely free: no prices, no Buy button, no accounts. Progress is saved on each phone.
- On first open the phone asks for the **4-digit family code**. The code is checked only on the server (Edge Function
  `family-unlock`). Only a bcrypt hash of it is stored (`app_secrets.family_code_hash`). It is not in any app code or repo.
- After the right code, the phone gets a long-lived **family token**. All lessons, meanings, audio and images are then downloaded from Supabase and work offline.
- 5 wrong tries (per phone and per internet connection) → locked for 10 minutes.

## Change the code (one SQL line)
Supabase → SQL editor (project words-3000-global), replace `1234` with the new code (exactly 4 digits):

```sql
update public.app_secrets set value = extensions.crypt('1234', extensions.gen_salt('bf', 10)) where key = 'family_code_hash';
```
Phones that are already unlocked stay unlocked. Only new phones need the new code.

## Lock out every family phone (revoke all tokens)
```sql
update public.app_secrets set value = encode(extensions.gen_random_bytes(32), 'hex') where key = 'family_token_secret';
```
Every phone asks for the code again the next time it is online, and deletes the downloaded lessons.

## Someone is locked out after wrong tries
```sql
delete from public.family_attempts;
```

## How the family build is made (keep both apps in sync)
1. Fix or change things in this repo (words-3000-global) and test the paid app as usual.
2. `python3 tools/build_family.py /workspace/words-3000-family` (rebuilds the family repo: drops the `//#paid-begin … //#paid-end` blocks, turns on the `/*#family-begin … #family-end*/` blocks, renames storage w3g→w3f, removes purchase/account strings, checks that no price / Lemon Squeezy / Play code and no paid lessons are in the output).
3. Commit + push the family repo. Its service worker cache is `w3f-v<same number as the paid app>`.
