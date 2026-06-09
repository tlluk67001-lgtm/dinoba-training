export const config = { runtime: 'edge' };

export default async function handler(req) {
  try {
    if (req.method !== 'POST') return r({ error: 'POST only' }, 405);

    const SUPA_URL = (process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
    const SUPA_KEY = (process.env.SUPABASE_ANON_KEY || '').trim();

    if (!SUPA_URL) return r({ error: 'SUPABASE_URL missing' }, 500);
    if (!SUPA_KEY) return r({ error: 'SUPABASE_ANON_KEY missing' }, 500);

    const body = await req.json();
    const { action, data } = body;
    const base = SUPA_URL + '/rest/v1';
    const H = {
      'apikey': SUPA_KEY,
      'Authorization': 'Bearer ' + SUPA_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    };

    if (action === 'loadAll') {
      const sRes = await fetch(base + '/students?select=*', { headers: H });
      const cRes = await fetch(base + '/settings?key=eq.coachPassword&select=value', { headers: H });
      return r({
        students: sRes.ok ? await sRes.json() : [],
        settings: cRes.ok ? await cRes.json() : [],
      });
    }

    if (action === 'saveStudent') {
      const u = encodeURIComponent(data.username);
      const chk = await fetch(base + '/students?username=eq.' + u + '&select=username', { headers: H });
      const exists = chk.ok && (await chk.json()).length > 0;
      const res = await fetch(
        base + '/students' + (exists ? '?username=eq.' + u : ''),
        { method: exists ? 'PATCH' : 'POST', headers: H, body: JSON.stringify(data) }
      );
      const detail = res.ok ? '' : await res.text().catch(() => '');
      return r({ ok: res.ok, status: res.status, detail });
    }

    if (action === 'deleteStudent') {
      const res = await fetch(
        base + '/students?username=eq.' + encodeURIComponent(data.username),
        { method: 'DELETE', headers: H }
      );
      return r({ ok: res.ok });
    }

    if (action === 'saveCoachPassword') {
      const res = await fetch(base + '/settings?key=eq.coachPassword', {
        method: 'PATCH', headers: H, body: JSON.stringify({ value: data.value })
      });
      return r({ ok: res.ok });
    }

    return r({ error: 'Unknown action: ' + action }, 400);

  } catch (e) {
    return r({ error: e.message, where: e.stack ? e.stack.split('\n')[1] : '' }, 500);
  }
}

function r(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}
