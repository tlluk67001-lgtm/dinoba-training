export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const URL = (process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
  const KEY = (process.env.SUPABASE_ANON_KEY || '').trim();

  if (!URL) return res.status(500).json({ error: 'SUPABASE_URL missing' });
  if (!KEY) return res.status(500).json({ error: 'SUPABASE_ANON_KEY missing' });

  const { action, data } = req.body || {};
  const base = URL + '/rest/v1';
  const H = {
    'apikey': KEY,
    'Authorization': 'Bearer ' + KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal',
  };

  try {
    if (action === 'loadAll') {
      const [sRes, cRes] = await Promise.all([
        fetch(base + '/students?select=*', { headers: H }),
        fetch(base + '/settings?key=eq.coachPassword&select=value', { headers: H }),
      ]);
      return res.json({
        students: sRes.ok ? await sRes.json() : [],
        settings: cRes.ok ? await cRes.json() : [],
      });
    }

    if (action === 'saveStudent') {
      const u = encodeURIComponent(data.username);
      const chk = await fetch(base + '/students?username=eq.' + u + '&select=username', { headers: H });
      const exists = chk.ok && (await chk.json()).length > 0;
      const sRes = await fetch(
        base + '/students' + (exists ? '?username=eq.' + u : ''),
        { method: exists ? 'PATCH' : 'POST', headers: H, body: JSON.stringify(data) }
      );
      const detail = sRes.ok ? '' : await sRes.text().catch(() => '');
      return res.json({ ok: sRes.ok, status: sRes.status, detail });
    }

    if (action === 'deleteStudent') {
      const dRes = await fetch(
        base + '/students?username=eq.' + encodeURIComponent(data.username),
        { method: 'DELETE', headers: H }
      );
      return res.json({ ok: dRes.ok });
    }

    if (action === 'saveCoachPassword') {
      const pRes = await fetch(base + '/settings?key=eq.coachPassword', {
        method: 'PATCH', headers: H, body: JSON.stringify({ value: data.value })
      });
      return res.json({ ok: pRes.ok });
    }

    return res.status(400).json({ error: 'Unknown action: ' + action });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
