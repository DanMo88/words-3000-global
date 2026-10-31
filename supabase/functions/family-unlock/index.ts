// family-unlock: the free family build (words-3000-family) asks for a 4-digit family code once per phone.
// verify_jwt = false (no accounts in the family build). The code is NOT in any client code or repo:
//   - app_secrets.family_code_hash = bcrypt hash of the code (change it with one SQL line, see store/FAMILY.md)
//   - public.family_try(keys, code) (service role only) checks the hash and rate-limits:
//     5 wrong tries per IP and per device → locked for 10 minutes; a correct code clears both counters.
// A correct code returns a long-lived family token, signed with its own secret (app_secrets.family_token_secret):
//   token = "f1." + base64url(JSON {d: device_id, t: issued_ms}) + "." + base64url(HMAC-SHA256(secret, payload part))
//   Changing the code does not log anyone out; rotating family_token_secret revokes every family phone.
// POST { device_id, code }  → 200 { token } | 403 { error: "wrong_code", left } | 429 { error: "locked", retry_after } | 400 bad_request
// POST { device_id, token } → 200 { ok: true } | 401 { error: "bad_token" }   (the app checks this when online)
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const ORIGINS = ["https://danmo88.github.io", "http://127.0.0.1:18791", "http://localhost:18791"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const cors = (req: Request) => { const o = req.headers.get("origin") || ""; return {
  "Access-Control-Allow-Origin": ORIGINS.includes(o) ? o : ORIGINS[0], "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin" }; };
const b64u = (u: Uint8Array) => btoa(String.fromCharCode(...u)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
async function hmac(secret: string, msg: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64u(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg))));
}
const same = (a: string, b: string) => { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; };

Deno.serve(async (req) => {
  const h = { ...cors(req), "Content-Type": "application/json", "Cache-Control": "no-store" }, out = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: h });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return out({ error: "method_not_allowed" }, 405);
  let b: { device_id?: string; code?: string; token?: string };
  try { b = await req.json(); } catch { return out({ error: "bad_request" }, 400); }
  const dev = String(b.device_id || "").toLowerCase(); if (!UUID.test(dev)) return out({ error: "bad_request" }, 400);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: s } = await admin.from("app_secrets").select("value").eq("key", "family_token_secret").maybeSingle();
  if (!s?.value) return out({ error: "not_configured" }, 501);

  if (typeof b.token === "string") {   // is this phone's token still valid?
    const m = /^f1\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(b.token);
    let ok = !!m && same(await hmac(s.value, m[1]), m[2]);
    if (ok) { try { ok = JSON.parse(atob(m![1].replace(/-/g, "+").replace(/_/g, "/"))).d === dev; } catch { ok = false; } }
    return ok ? out({ ok: true }) : out({ error: "bad_token" }, 401);
  }
  const code = String(b.code ?? "");
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
  const { data: r, error } = await admin.rpc("family_try", { p_keys: ["ip:" + ip, "dev:" + dev], p_code: code });
  if (error || !r) return out({ error: "server" }, 500);
  if (r.error === "not_configured") return out({ error: "not_configured" }, 501);
  if (r.locked) return out({ error: "locked", retry_after: r.retry_after || 600 }, 429);
  if (!r.ok) return out({ error: "wrong_code", left: r.left ?? 0 }, 403);
  const payload = b64u(new TextEncoder().encode(JSON.stringify({ d: dev, t: Date.now() })));
  return out({ token: "f1." + payload + "." + await hmac(s.value, payload) });
});
