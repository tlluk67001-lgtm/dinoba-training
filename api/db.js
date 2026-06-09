// api/db.js — Google Apps Script proxy with proper redirect handling
export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return resp({ error: 'Method not allowed' }, 405);
  }

  const SHEET_URL = process.env.GOOGLE_SHEET_URL;
  if (!SHEET_URL) return resp({ error: 'GOOGLE_SHEET_URL not set in Vercel env vars' }, 500);

  let body;
  try { body = await req.json(); }
  catch { return resp({ error: 'Invalid JSON' }, 400); }

  try {
    // POST to Google Apps Script — use manual redirect so body isn't lost
    const postRes = await fetch(SHEET_URL, {
      method: 'POST',
      redirect: 'manual',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(body),
    });

    let text;

    if (postRes.status >= 300 && postRes.status < 400) {
      // Google Apps Script redirects to the actual response URL — follow with GET
      const location = postRes.headers.get('location');
      if (location) {
        const getRes = await fetch(location);
        text = await getRes.text();
      } else {
        text = await postRes.text();
      }
    } else {
      text = await postRes.text();
    }

    // Return the response to the browser
    return new Response(text, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (e) {
    return resp({ error: e.message }, 500);
  }
}

function resp(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
