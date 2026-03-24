const CF_URL = `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/d1/database/${process.env.CF_D1_DATABASE_ID}/query`;
const CF_TOKEN = process.env.CF_API_TOKEN;

async function d1(sql, params = []) {
  const r = await fetch(CF_URL, {
    method: "POST",
    headers: { "Authorization": `Bearer ${CF_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ sql, params })
  });
  const j = await r.json();
  if (!j.success) throw new Error(JSON.stringify(j.errors));
  return j.result[0].results;
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (!process.env.CF_ACCOUNT_ID || !process.env.CF_D1_DATABASE_ID || !process.env.CF_API_TOKEN) {
    return res.status(500).json({ error: "Cloudflare D1 not configured" });
  }

  try {
    if (req.method === "GET") {
      const rows = await d1(
        "SELECT id, file_name, mode, saved_at, session_data FROM sessions ORDER BY saved_at DESC LIMIT 20"
      );
      const sessions = rows.map(row => {
        let data = {};
        try { data = JSON.parse(row.session_data); } catch (e) {}
        return { ...data, _cloudId: row.id };
      });
      return res.status(200).json(sessions);
    }

    if (req.method === "POST") {
      const session = req.body;
      if (!session || !session.id) return res.status(400).json({ error: "Missing session id" });
      await d1(
        `INSERT INTO sessions (id, file_name, mode, saved_at, session_data)
         VALUES (?,?,?,?,?)
         ON CONFLICT(id) DO UPDATE SET
           file_name=excluded.file_name, mode=excluded.mode,
           saved_at=excluded.saved_at, session_data=excluded.session_data`,
        [
          session.id,
          session.fileName || null,
          session.mode || "analyzer",
          new Date(session.savedAt || Date.now()).toISOString(),
          JSON.stringify(session)
        ]
      );
      return res.status(200).json({ ok: true });
    }

    if (req.method === "DELETE") {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: "Missing id" });
      await d1("DELETE FROM sessions WHERE id = ?", [id]);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
