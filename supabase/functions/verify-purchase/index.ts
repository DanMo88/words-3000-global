// verify-purchase: validates a Google Play subscription purchase token and sets profiles.premium server-side.
// DISABLED until Daniel configures these Edge Function secrets (Supabase dashboard → Edge Functions → Secrets):
//   PLAY_VERIFY_ENABLED = "true"
//   PLAY_PACKAGE_NAME   = the Android package id of the TWA (e.g. io.github.danmo88.words3000)
//   GOOGLE_SERVICE_ACCOUNT_JSON = the full JSON key of a Google Cloud service account that has
//                                 "View financial data" + "Manage orders and subscriptions" in Play Console
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically (never put them in the repo).
// Request: POST { purchaseToken, productId } with the user's Authorization: Bearer <access token>.
import { createClient } from "npm:@supabase/supabase-js@2";

const PRODUCT_ID = "premium_monthly";
const ORIGINS = ["https://danmo88.github.io", "http://127.0.0.1:18791", "http://localhost:18791"];
const cors = (req: Request) => {
  const o = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ORIGINS.includes(o) ? o : ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
};
const json = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json" } });

const b64url = (b: ArrayBuffer | Uint8Array | string) => {
  const bytes = typeof b === "string" ? new TextEncoder().encode(b) : new Uint8Array(b);
  let s = ""; bytes.forEach((x) => (s += String.fromCharCode(x)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
async function googleToken(sa: { client_email: string; private_key: string }) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({
    iss: sa.client_email, scope: "https://www.googleapis.com/auth/androidpublisher",
    aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600,
  }));
  const pem = sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(head + "." + claim));
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: head + "." + claim + "." + b64url(sig) }),
  });
  if (!r.ok) throw new Error("google_auth_failed");
  return (await r.json()).access_token as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, { error: "method_not_allowed" }, 405);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: u, error: ue } = jwt ? await admin.auth.getUser(jwt) : { data: null, error: true };
  if (ue || !u?.user) return json(req, { error: "not_signed_in" }, 401);
  const uid = u.user.id;

  const pkg = Deno.env.get("PLAY_PACKAGE_NAME"), saRaw = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (Deno.env.get("PLAY_VERIFY_ENABLED") !== "true" || !pkg || !saRaw) return json(req, { error: "billing_not_configured" }, 501);

  let body: { purchaseToken?: string; productId?: string };
  try { body = await req.json(); } catch { return json(req, { error: "bad_json" }, 400); }
  const token = String(body.purchaseToken || "");
  if (token.length < 10 || token.length > 4096 || (body.productId && body.productId !== PRODUCT_ID)) return json(req, { error: "bad_request" }, 400);

  // a token may belong to one account only
  const { data: prev } = await admin.from("play_purchases").select("user_id").eq("purchase_token", token).maybeSingle();
  if (prev && prev.user_id !== uid) return json(req, { error: "token_used_by_other_account" }, 409);

  let access: string;
  try { access = await googleToken(JSON.parse(saRaw)); } catch { return json(req, { error: "google_auth_failed" }, 502); }
  const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(pkg)}/purchases`;
  const g = await fetch(`${base}/subscriptionsv2/tokens/${encodeURIComponent(token)}`, { headers: { Authorization: `Bearer ${access}` } });
  if (g.status === 404 || g.status === 410) return json(req, { error: "invalid_token" }, 400);
  if (!g.ok) return json(req, { error: "google_error", status: g.status }, 502);
  const sub = await g.json();
  const line = (sub.lineItems || []).find((l: { productId: string }) => l.productId === PRODUCT_ID);
  if (!line) return json(req, { error: "wrong_product" }, 400);
  const expires = line.expiryTime ? new Date(line.expiryTime) : null;
  const state = String(sub.subscriptionState || "");
  const active = ["SUBSCRIPTION_STATE_ACTIVE", "SUBSCRIPTION_STATE_IN_GRACE_PERIOD"].includes(state) ||
    (state === "SUBSCRIPTION_STATE_CANCELED" && !!expires && expires > new Date());   // canceled but paid until expiry

  if (active && sub.acknowledgementState === "ACKNOWLEDGEMENT_STATE_PENDING") {
    await fetch(`${base}/subscriptions/${encodeURIComponent(PRODUCT_ID)}/tokens/${encodeURIComponent(token)}:acknowledge`,
      { method: "POST", headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" }, body: "{}" });
  }
  await admin.from("play_purchases").upsert({ purchase_token: token, user_id: uid, product_id: PRODUCT_ID, state, expires_at: expires?.toISOString() ?? null, raw: sub, updated_at: new Date().toISOString() });
  await admin.from("profiles").update({ premium: active, premium_until: active ? expires?.toISOString() ?? null : null }).eq("id", uid);
  return json(req, { premium: active, state, expires_at: expires?.toISOString() ?? null });
});
