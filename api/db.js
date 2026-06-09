export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return r({ error: 'Method not allowed' }, 405);
  }

  const URL = process.env.SUPABASE_URL;
  const KEY = process.env.SUPABASE_ANON_KEY;

  if (!URL || !KEY) return r({ error: 'Missing env vars: SUPABASE_URL or SUPABASE_ANON_KEY' }, 500);

  const body = await req.json().catch(() => null);
  if (!body) return r({ error: 'Invalid JSON' }, 400);

  const { action, data } = body;
  const base = URL.replace(/\/$/, '') + '/rest/v1';
  const h = {
    'apikey': KEY,
    'Authorization': 'Bearer ' + KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal',
  };

  if (action === 'loadAll') {
    const [a, b] = await Promise.all([
      fetch(base + '/students?select=*', { headers: h }),
      fetch(base + '/settings?key=eq.coachPassword&select=value', { headers: h }),
    ]);
    return r({
      students: a.ok ? await a.json() : [],
      settings: b.ok ? await b.json() : [],
    });
  }

  if (action === 'saveStudent') {
    const u = encodeURIComponent(data.username);
    const check = await fetch(base + '/students?username=eq.' + u + '&select=username', { headers: h });
    const exists = check.ok && (await check.json()).length > 0;
    const res = await fetch(base + '/students' + (exists ? '?username=eq.' + u : ''), {
      method: exists ? 'PATCH' : 'POST',
      headers: h,
      body: JSON.stringify(data),
    });
    const txt = res.ok ? '' : await res.text().catch(() => '');
    return r({ ok: res.ok, status: res.status, err: txt });
  }

  if (action === 'deleteStudent') {
    const res = await fetch(base + '/students?username=eq.' + encodeURIComponent(data.username), {
      method: 'DELETE', headers: h,
    });
    return r({ ok: res.ok });
  }

  if (action === 'saveCoachPassword') {
    const res = await fetch(base + '/settings?key=eq.coachPassword', {
      method: 'PATCH', headers: h, body: JSON.stringify({ value: data.value }),
    });
    return r({ ok: res.ok });
  }

  return r({ error: 'Unknown action: ' + action }, 400);
}

function r(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}
