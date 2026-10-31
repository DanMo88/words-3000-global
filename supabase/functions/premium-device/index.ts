// premium-device: one active premium device per account (server-enforced).
// POST { device_id: uuid, label: string, claim?: boolean } with the user's JWT (verify_jwt = true).
// - registers / touches this device (last_seen)
// - links a paid Lemon Squeezy order bought with this account's email but without user id (e.g. hosted checkout link)
// - if the account is premium and no device is active → this device becomes active
// - claim = true moves premium here, at most once per 30 days (profiles.device_moved_at)
// Returns { premium, premium_until, active, other: {label,last_seen} | null, can_move, next_move_at }
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const ORIGINS = ["https://danmo88.github.io", "http://127.0.0.1:18791", "http://localhost:18791"];
const MOVE_DAYS = 30;
const cors = (req: Request) => { const o = req.headers.get("origin") || ""; return {
  "Access-Control-Allow-Origin": ORIGINS.includes(o) ? o : ORIGINS[0], "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin" }; };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  const h = { ...cors(req), "Content-Type": "application/json" }, out = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: h });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return out({ error: "method_not_allowed" }, 405);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
  const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: u } = jwt ? await admin.auth.getUser(jwt) : { data: null };
  if (!u?.user) return out({ error: "not_signed_in" }, 401);
  const uid = u.user.id, email = (u.user.email || "").toLowerCase();
  let b: { device_id?: string; label?: string; claim?: boolean };
  try { b = await req.json(); } catch { return out({ error: "bad_json" }, 400); }
  const dev = String(b.device_id || ""); if (!UUID.test(dev)) return out({ error: "bad_device" }, 400);
  const label = String(b.label || "").replace(/[<>]/g, "").slice(0, 80) || null, now = new Date();

  // link unlinked paid orders bought with this email
  if (email) {
    const { data: un } = await admin.from("purchases").select("order_id").is("user_id", null).eq("email", email).eq("status", "paid");
    if (un?.length) { await admin.from("purchases").update({ user_id: uid, updated_at: now.toISOString() }).in("order_id", un.map((r) => r.order_id));
      await admin.from("profiles").update({ premium: true, premium_until: null }).eq("id", uid); }
  }
  await admin.from("devices").upsert({ user_id: uid, device_id: dev, label, last_seen: now.toISOString() }, { onConflict: "user_id,device_id", ignoreDuplicates: false });

  const { data: p } = await admin.from("profiles").select("premium,premium_until,device_moved_at").eq("id", uid).maybeSingle();
  const premium = !!p?.premium && (!p.premium_until || new Date(p.premium_until).getTime() + 3 * 864e5 > now.getTime());
  const nextMove = p?.device_moved_at ? new Date(new Date(p.device_moved_at).getTime() + MOVE_DAYS * 864e5) : null;
  const canMove = !nextMove || nextMove <= now;
  const base = { premium, premium_until: p?.premium_until ?? null, can_move: canMove, next_move_at: canMove ? null : nextMove!.toISOString() };
  if (!premium) return out({ ...base, active: false, other: null });

  const { data: act } = await admin.from("devices").select("device_id,label,last_seen").eq("user_id", uid).eq("active", true).maybeSingle();
  if (!act) {   // first premium device: no move needed
    await admin.from("devices").update({ active: true }).eq("user_id", uid).eq("device_id", dev);
    return out({ ...base, active: true, other: null });
  }
  if (act.device_id === dev) return out({ ...base, active: true, other: null });
  const other = { label: act.label, last_seen: act.last_seen };
  if (!b.claim) return out({ ...base, active: false, other });
  if (!canMove) return out({ ...base, active: false, other, error: "move_limit" }, 429);
  await admin.from("devices").update({ active: false }).eq("user_id", uid).eq("active", true);
  const { error } = await admin.from("devices").update({ active: true }).eq("user_id", uid).eq("device_id", dev);
  if (error) return out({ error: "db" }, 500);
  await admin.from("profiles").update({ device_moved_at: now.toISOString() }).eq("id", uid);
  const nm = new Date(now.getTime() + MOVE_DAYS * 864e5).toISOString();
  return out({ ...base, can_move: false, next_move_at: nm, active: true, other: null, moved: true });
});
