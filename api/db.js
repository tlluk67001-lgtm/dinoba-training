// api/db.js — Supabase proxy (Vercel Edge Function)
export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return resp({ error: 'Method not allowed' }, 405);
  }

  const SUPA_URL = process.env.SUPABASE_URL;
  const SUPA_KEY = process.env.SUPABASE_ANON_KEY;

  if (!SUPA_URL || !SUPA_KEY) {
    return resp({ error: 'Supabase env vars missing' }, 500);
  }

  let body;
  try { body = await req.json(); }
  catch { return resp({ error: 'Invalid JSON' }, 400); }

  const { action, data } = body;
  const base = SUPA_URL + '/rest/v1';
  const headers = {
    'apikey': SUPA_KEY,
    'Authorization': 'Bearer ' + SUPA_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal',
  };

  try {
    if (action === 'loadAll') {
      const [sRes, cRes] = await Promise.all([
        fetch(base + '/students?select=*', { headers }),
        fetch(base + '/settings?key=eq.coachPassword&select=value', { headers }),
      ]);
      const students = sRes.ok ? await sRes.json() : [];
      const settings = cRes.ok ? await cRes.json() : [];
      return resp({ students, settings });
    }

    if (action === 'saveStudent') {
      const username = data.username;
      if (!username) return resp({ error: 'Missing username' }, 400);
      const checkRes = await fetch(
        base + '/students?username=eq.' + encodeURIComponent(username) + '&select=username',
        { headers }
      );
      const existing = checkRes.ok ? await checkRes.json() : [];
      let res;
      if (existing.length > 0) {
        res = await fetch(base + '/students?username=eq.' + encodeURIComponent(username), {
          method: 'PATCH', headers, body: JSON.stringify(data)
        });
      } else {
        res = await fetch(base + '/students', {
          method: 'POST', headers, body: JSON.stringify(data)
        });
      }
      if (!res.ok) {
        const t = await res.text().catch(()=>'');
        console.error('saveStudent error:', res.status, t);
      }
      return resp({ ok: res.ok, status: res.status });
    }

    if (action === 'deleteStudent') {
      const username = data.username;
      const res = await fetch(
        base + '/students?username=eq.' + encodeURIComponent(username),
        { method: 'DELETE', headers }
      );
      return resp({ ok: res.ok });
    }

    if (action === 'saveCoachPassword') {
      const res = await fetch(base + '/settings?key=eq.coachPassword', {
        method: 'PATCH', headers, body: JSON.stringify({ value: data.value })
      });
      return resp({ ok: res.ok });
    }

    return resp({ error: 'Unknown action: ' + action }, 400);

  } catch (e) {
    console.error('DB error:', e);
    return resp({ error: e.message }, 500);
  }
}

function resp(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}
