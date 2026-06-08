// api/db.js — Supabase proxy (Vercel Edge Function)
// All database operations go through here. Keys stay on the server.
// Deploy at: api/db.js in your GitHub repo.

export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const SUPA_URL = process.env.SUPABASE_URL;
  const SUPA_KEY = process.env.SUPABASE_ANON_KEY;

  if (!SUPA_URL || !SUPA_KEY) {
    return json({ error: 'Supabase not configured in environment variables' }, 500);
  }

  let body;
  try { body = await req.json(); }
  catch { return json({ error: 'Invalid JSON' }, 400); }

  const { action, data } = body;
  const base = SUPA_URL + '/rest/v1';
  const headers = {
    'apikey': SUPA_KEY,
    'Authorization': 'Bearer ' + SUPA_KEY,
    'Content-Type': 'application/json',
  };

  try {
    // ── Load all students + coach password ────────────────────────────────
    if (action === 'loadAll') {
      const [sRes, cRes] = await Promise.all([
        fetch(base + '/students?select=*', { headers }),
        fetch(base + '/settings?key=eq.coachPassword&select=value', { headers }),
      ]);
      const students = sRes.ok ? await sRes.json() : [];
      const settings = cRes.ok ? await cRes.json() : [];
      return json({ students, settings });
    }

    // ── Save (upsert) one student ─────────────────────────────────────────
    if (action === 'saveStudent') {
      const username = data.username;
      if (!username) return json({ error: 'Missing username' }, 400);

      // Check if student already exists
      const checkRes = await fetch(
        base + '/students?username=eq.' + encodeURIComponent(username) + '&select=username',
        { headers }
      );
      const existing = checkRes.ok ? await checkRes.json() : [];

      let res;
      if (existing.length > 0) {
        // Update
        res = await fetch(
          base + '/students?username=eq.' + encodeURIComponent(username),
          { method: 'PATCH', headers: { ...headers, 'Prefer': 'return=minimal' }, body: JSON.stringify(data) }
        );
      } else {
        // Insert
        res = await fetch(
          base + '/students',
          { method: 'POST', headers: { ...headers, 'Prefer': 'return=minimal' }, body: JSON.stringify(data) }
        );
      }
      const ok = res.ok;
      if (!ok) {
        const errText = await res.text().catch(() => '');
        console.error('saveStudent error:', res.status, errText);
      }
      return json({ ok, status: res.status });
    }

    // ── Delete one student ────────────────────────────────────────────────
    if (action === 'deleteStudent') {
      const username = data.username;
      if (!username) return json({ error: 'Missing username' }, 400);
      const res = await fetch(
        base + '/students?username=eq.' + encodeURIComponent(username),
        { method: 'DELETE', headers }
      );
      return json({ ok: res.ok });
    }

    // ── Update coach password ─────────────────────────────────────────────
    if (action === 'saveCoachPassword') {
      const res = await fetch(
        base + '/settings?key=eq.coachPassword',
        { method: 'PATCH', headers: { ...headers, 'Prefer': 'return=minimal' }, body: JSON.stringify({ value: data.value }) }
      );
      return json({ ok: res.ok });
    }

    return json({ error: 'Unknown action: ' + action }, 400);

  } catch (e) {
    console.error('DB proxy error:', e);
    return json({ error: e.message }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
