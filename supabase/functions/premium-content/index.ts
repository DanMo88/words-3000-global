// premium-content: serves the premium lessons (lesson index >= FREE per level) only to a signed-in Premium user
// on the account's ACTIVE device (same rule as premium-device). verify_jwt = true.
// POST { device_id, lang, levels: ["A1",...] }  → { version, free, levels: { A1: { from, lessons: [[[id,w,ex,img],...],...] } }, meanings: { A1: { id: meaning } } }
//   (meanings: all levels for lang; levels: [] = meanings only, e.g. after a language switch)
// POST { device_id, media: ["audio/x.mp3", "audio/x-ex.mp3", "img/x.webp", ...] } → { urls: { path: signedUrl } } (10 min, private bucket premium-media)
// Text lives in server-only tables content_lessons / content_meanings (RLS on, no client grants); media in a private bucket.
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const ORIGINS = ["https://danmo88.github.io", "http://127.0.0.1:18791", "http://localhost:18791"];
const LEVELS = ["A1", "A2", "B1", "B2"];
const MEDIA = /^(audio\/[a-z0-9-]+\.mp3|img\/[a-z0-9-]+\.webp)$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const cors = (req: Request) => { const o = req.headers.get("origin") || ""; return {
  "Access-Control-Allow-Origin": ORIGINS.includes(o) ? o : ORIGINS[0], "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin" }; };

Deno.serve(async (req) => {
  const h = { ...cors(req), "Content-Type": "application/json", "Cache-Control": "no-store" }, out = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: h });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return out({ error: "method_not_allowed" }, 405);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
  const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: u } = jwt ? await admin.auth.getUser(jwt) : { data: null };
  if (!u?.user) return out({ error: "not_signed_in" }, 401);
  let b: { device_id?: string; lang?: string; levels?: string[]; media?: string[] };
  try { b = await req.json(); } catch { return out({ error: "bad_json" }, 400); }
  const dev = String(b.device_id || ""); if (!UUID.test(dev)) return out({ error: "bad_device" }, 400);

  const { data: p } = await admin.from("profiles").select("premium,premium_until").eq("id", u.user.id).maybeSingle();
  const premium = !!p?.premium && (!p.premium_until || new Date(p.premium_until).getTime() + 3 * 864e5 > Date.now());
  if (!premium) return out({ error: "not_premium" }, 403);
  const { data: d } = await admin.from("devices").select("device_id").eq("user_id", u.user.id).eq("device_id", dev).eq("active", true).maybeSingle();
  if (!d) return out({ error: "not_active_device" }, 403);
  await admin.from("devices").update({ last_seen: new Date().toISOString() }).eq("user_id", u.user.id).eq("device_id", dev);

  if (Array.isArray(b.media)) {
    const paths = [...new Set(b.media.map(String))].filter((x) => MEDIA.test(x)).slice(0, 150);
    if (!paths.length) return out({ urls: {} });
    const { data, error } = await admin.storage.from("premium-media").createSignedUrls(paths, 600);
    if (error) return out({ error: "storage" }, 500);
    const urls: Record<string, string> = {}; (data || []).forEach((x) => { if (x.signedUrl && x.path) urls[x.path] = x.signedUrl; });
    return out({ urls });
  }
  const levels = (Array.isArray(b.levels) ? b.levels : LEVELS).filter((l) => LEVELS.includes(l));
  const lang = /^[a-z]{2,3}$/.test(String(b.lang || "")) ? String(b.lang) : "";
  const [{ data: meta }, { data: ls, error: e1 }, { data: ms, error: e2 }] = await Promise.all([
    admin.from("content_meta").select("value").eq("key", "content").maybeSingle(),
    levels.length ? admin.from("content_lessons").select("level,idx,words").in("level", levels).order("idx") : Promise.resolve({ data: [], error: null }),
    lang ? admin.from("content_meanings").select("level,data").eq("lang", lang) : Promise.resolve({ data: [], error: null }),
  ]);
  if (e1 || e2) return out({ error: "db" }, 500);
  const free = meta?.value?.free ?? 5, res: Record<string, { from: number; lessons: unknown[] }> = {}, mean: Record<string, unknown> = {};
  levels.forEach((l) => (res[l] = { from: free, lessons: [] }));
  (ls || []).forEach((r) => { res[r.level].lessons[r.idx - free] = r.words; });
  (ms || []).forEach((r) => { mean[r.level] = r.data; });
  return out({ version: meta?.value?.version ?? 0, free, lang, levels: res, meanings: mean });
});
