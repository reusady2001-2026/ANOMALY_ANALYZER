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

function safeParseJSON(str, fallback) {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch (e) { return fallback; }
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (!process.env.CF_ACCOUNT_ID || !process.env.CF_D1_DATABASE_ID || !process.env.CF_API_TOKEN) {
    return res.status(500).json({ error: "Cloudflare D1 not configured" });
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const rows = await d1(
      `SELECT * FROM rule_candidates
       WHERE status = 'candidate'
         AND distinct_property_count >= 3
         AND occurrences_since_last_dismissal >= 20
         AND dismissal_count < 5
       ORDER BY total_occurrences DESC
       LIMIT 5`
    );

    const candidates = rows.map(row => ({
      ...row,
      distinct_properties: safeParseJSON(row.distinct_properties, []),
      suggested_rules:     safeParseJSON(row.suggested_rules, []),
      anomaly_history:     safeParseJSON(row.anomaly_history, []),
    }));

    return res.status(200).json({ success: true, candidates });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
