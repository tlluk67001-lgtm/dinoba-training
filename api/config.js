// api/config.js — returns public Supabase config to the browser
// Deploy this file at: api/config.js in your GitHub repo

export const config = { runtime: 'edge' };

export default function handler() {
  return new Response(JSON.stringify({
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseKey: process.env.SUPABASE_ANON_KEY || '',
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
