// Deletes the calling user's account. profiles + progress rows are removed by ON DELETE CASCADE.
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';

const ORIGINS = ['https://danmo88.github.io', 'http://127.0.0.1:18791', 'http://localhost:18791'];
const cors = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin && ORIGINS.includes(origin) ? origin : ORIGINS[0],
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
});

Deno.serve(async (req: Request) => {
  const h = cors(req.headers.get('Origin'));
  if (req.method === 'OPTIONS') return new Response('ok', { headers: h });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'method' }), { status: 405, headers: { ...h, 'Content-Type': 'application/json' } });
  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await admin.auth.getUser(jwt);
  if (error || !data?.user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...h, 'Content-Type': 'application/json' } });
  const uid = data.user.id;
  await admin.from('progress').delete().eq('user_id', uid);
  await admin.from('profiles').delete().eq('id', uid);
  const del = await admin.auth.admin.deleteUser(uid);
  if (del.error) return new Response(JSON.stringify({ error: del.error.message }), { status: 500, headers: { ...h, 'Content-Type': 'application/json' } });
  return new Response(JSON.stringify({ deleted: true }), { headers: { ...h, 'Content-Type': 'application/json' } });
});
