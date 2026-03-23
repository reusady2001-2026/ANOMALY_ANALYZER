const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: "Supabase not configured" });
  }

  const headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
  };

  if (req.method === "GET") {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/sessions?order=saved_at.desc&limit=20`,
      { headers }
    );
    if (!r.ok) {
      const e = await r.text();
      return res.status(r.status).json({ error: e });
    }
    const rows = await r.json();
    const sessions = rows.map(row => ({ ...row.session_data, _cloudId: row.id }));
    return res.status(200).json(sessions);
  }

  if (req.method === "POST") {
    const session = req.body;
    if (!session || !session.id) return res.status(400).json({ error: "Missing session id" });
    const payload = {
      id: session.id,
      file_name: session.fileName || null,
      mode: session.mode || "analyzer",
      saved_at: new Date(session.savedAt || Date.now()).toISOString(),
      session_data: session
    };
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/sessions`,
      {
        method: "POST",
        headers: { ...headers, "Prefer": "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(payload)
      }
    );
    if (!r.ok) {
      const e = await r.text();
      return res.status(r.status).json({ error: e });
    }
    return res.status(200).json({ ok: true });
  }

  if (req.method === "DELETE") {
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: "Missing id" });
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/sessions?id=eq.${encodeURIComponent(id)}`,
      { method: "DELETE", headers }
    );
    if (!r.ok) {
      const e = await r.text();
      return res.status(r.status).json({ error: e });
    }
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
};
