// lemonsqueezy-webhook: one-time "$5 lifetime" purchases sold through Lemon Squeezy (merchant of record).
// Auth = the X-Signature header (HMAC-SHA256 of the raw body with the webhook signing secret), so deploy with verify_jwt = false.
// DISABLED (501) until a signing secret exists:
//   - preferred: Edge Function secret LEMONSQUEEZY_SIGNING_SECRET (Supabase dashboard → Edge Functions → Secrets)
//   - or a row in public.app_secrets (key 'lemonsqueezy_signing_secret'), readable only with the service role
// Optional secrets: LEMONSQUEEZY_STORE_ID / LEMONSQUEEZY_VARIANT_ID (orders for other stores/products are ignored).
// Handles: order_created (status "paid") → purchases row + profiles.premium = true, premium_until = null (lifetime)
//          order_refunded → purchases.status = "refunded" + premium revoked unless another paid purchase exists.
// Idempotent: purchases.order_id is the primary key; replays do not change the result.
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function signingSecret(): Promise<string | null> {
  const env = Deno.env.get("LEMONSQUEEZY_SIGNING_SECRET");
  if (env) return env;
  const { data } = await admin.from("app_secrets").select("value").eq("key", "lemonsqueezy_signing_secret").maybeSingle();
  return data?.value || null;
}
async function hmacHex(secret: string, body: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
  return [...sig].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
async function setPremium(uid: string) {
  const { count } = await admin.from("purchases").select("order_id", { count: "exact", head: true }).eq("user_id", uid).eq("status", "paid");
  const paid = (count || 0) > 0;
  if (paid) await admin.from("profiles").update({ premium: true, premium_until: null }).eq("id", uid);
  else {   // keep a still-running Google Play subscription (premium_until in the future), revoke lifetime premium
    const { data: pr } = await admin.from("profiles").select("premium_until").eq("id", uid).maybeSingle();
    if (!pr?.premium_until || new Date(pr.premium_until) <= new Date()) await admin.from("profiles").update({ premium: false, premium_until: null }).eq("id", uid);
  }
  return paid;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const secret = await signingSecret();
  if (!secret) return json({ error: "webhook_not_configured" }, 501);
  const raw = await req.text();
  const sig = (req.headers.get("x-signature") || "").trim().toLowerCase();
  if (!sig || !safeEqual(await hmacHex(secret, raw), sig)) return json({ error: "bad_signature" }, 401);

  let ev: any; try { ev = JSON.parse(raw); } catch { return json({ error: "bad_json" }, 400); }
  const name = ev?.meta?.event_name, a = ev?.data?.attributes || {}, orderId = String(ev?.data?.id || "");
  if (ev?.data?.type !== "orders" || !orderId) return json({ ignored: name || "unknown" });
  const store = Deno.env.get("LEMONSQUEEZY_STORE_ID"), variant = Deno.env.get("LEMONSQUEEZY_VARIANT_ID");
  const variantId = String(a?.first_order_item?.variant_id ?? "");
  if ((store && String(a.store_id) !== store) || (variant && variantId !== variant)) return json({ ignored: "other_product" });

  let uid = String(ev?.meta?.custom_data?.user_id || "");
  if (!UUID.test(uid)) uid = "";
  if (uid) { const { data } = await admin.from("profiles").select("id").eq("id", uid).maybeSingle(); if (!data) uid = ""; }
  const { data: prev } = await admin.from("purchases").select("user_id,status").eq("order_id", orderId).maybeSingle();
  uid = uid || prev?.user_id || "";

  if (name === "order_created") {
    // a refund is final: a replayed order_created never turns a refunded order back into paid
    const status = prev?.status === "refunded" ? "refunded" : (a.status === "paid" ? "paid" : String(a.status || "pending"));
    const row = { order_id: orderId, user_id: uid || null, email: a.user_email ? String(a.user_email).toLowerCase() : null, status: ["paid", "refunded", "pending", "failed"].includes(status) ? status : "pending",
      amount: Number.isFinite(a.total) ? a.total : null, currency: a.currency || null, variant_id: variantId || null, test_mode: !!a.test_mode, updated_at: new Date().toISOString() };
    const { error } = await admin.from("purchases").upsert(row);
    if (error) return json({ error: "db" }, 500);
    const premium = uid ? await setPremium(uid) : false;
    return json({ ok: true, order: orderId, status: row.status, linked: !!uid, premium });
  }
  if (name === "order_refunded") {
    const { error } = await admin.from("purchases").upsert({ order_id: orderId, user_id: uid || null, status: "refunded", amount: Number.isFinite(a.total) ? a.total : null, currency: a.currency || null, variant_id: variantId || null, test_mode: !!a.test_mode, updated_at: new Date().toISOString() });
    if (error) return json({ error: "db" }, 500);
    const premium = uid ? await setPremium(uid) : false;
    return json({ ok: true, order: orderId, status: "refunded", premium });
  }
  return json({ ignored: name });
});
