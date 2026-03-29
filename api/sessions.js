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

  // Auto-migration: add platform column if it doesn't exist yet
  try {
    await d1("ALTER TABLE sessions ADD COLUMN platform TEXT NOT NULL DEFAULT 'operational'");
  } catch (e) { /* column already exists — ignore */ }

  try {
    if (req.method === "GET") {
      // Serve chunk rows for a specific session (used when restoring chunked sessions)
      if (req.query.chunksFor) {
        const rows = await d1(
          "SELECT session_data FROM sessions WHERE id LIKE ? ORDER BY id",
          [req.query.chunksFor + "@@%"]
        );
        const chunks = rows.map(row => {
          try { return JSON.parse(row.session_data); } catch (e) { return {}; }
        });
        return res.status(200).json(chunks);
      }
      // Normal listing — filter by platform if provided, exclude internal chunk rows
      const platform = req.query.platform || null;
      const rows = platform
        ? await d1(
            "SELECT id, file_name, mode, saved_at, session_data FROM sessions WHERE id NOT LIKE '%@@%' AND platform=? ORDER BY saved_at DESC LIMIT 50",
            [platform]
          )
        : await d1(
            "SELECT id, file_name, mode, saved_at, session_data FROM sessions WHERE id NOT LIKE '%@@%' ORDER BY saved_at DESC LIMIT 50"
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
      const platform = session.platform || "operational";
      await d1(
        `INSERT INTO sessions (id, file_name, mode, platform, saved_at, session_data)
         VALUES (?,?,?,?,?,?)
         ON CONFLICT(id) DO UPDATE SET
           file_name=excluded.file_name, mode=excluded.mode,
           platform=excluded.platform,
           saved_at=excluded.saved_at, session_data=excluded.session_data`,
        [
          session.id,
          session.fileName || null,
          session.mode || "analyzer",
          platform,
          new Date(session.savedAt || Date.now()).toISOString(),
          JSON.stringify(session)
        ]
      );
      return res.status(200).json({ ok: true });
    }

    if (req.method === "DELETE") {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: "Missing id" });
      // Delete main row + any chunk rows
      await d1("DELETE FROM sessions WHERE id = ? OR id LIKE ?", [id, id + "@@%"]);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
