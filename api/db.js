// api/db.js — Supabase proxy (Vercel Edge Function)
// All database operations go through here. Keys stay on the server.

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
    'Accept': 'application/json',
  };

  try {
    // ── Load all students + coach password ────────────────────────────────
    if (action === 'loadAll') {
      const [sRes, cRes] = await Promise.all([
        fetch(base + '/students?select=*&order=created_at.asc', { headers }),
        fetch(base + '/settings?key=eq.coachPassword&select=value', { headers }),
      ]);
      if (!sRes.ok) console.error('loadAll students error:', sRes.status, await sRes.text().catch(() => ''));
      if (!cRes.ok) console.error('loadAll settings error:', cRes.status, await cRes.text().catch(() => ''));
      const students = sRes.ok ? await sRes.json() : [];
      const settings = cRes.ok ? await cRes.json() : [];
      return json({ students, settings });
    }

    // ── Upsert one student (insert or update by username) ─────────────────
    if (action === 'saveStudent') {
      const username = data.username;
      if (!username) return json({ error: 'Missing username' }, 400);

      const res = await fetch(
        base + '/students?on_conflict=username',
        {
          method: 'POST',
          headers: { ...headers, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify(data),
        }
      );
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

    // ── Upsert coach password (insert if missing, update if exists) ───────
    if (action === 'saveCoachPassword') {
      const res = await fetch(
        base + '/settings?on_conflict=key',
        {
          method: 'POST',
          headers: { ...headers, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify({ key: 'coachPassword', value: data.value }),
        }
      );
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.error('saveCoachPassword error:', res.status, errText);
      }
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
