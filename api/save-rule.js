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
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (!process.env.CF_ACCOUNT_ID || !process.env.CF_D1_DATABASE_ID || !process.env.CF_API_TOKEN) {
    return res.status(500).json({ error: "Cloudflare D1 not configured" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { action, candidateId, ruleText } = req.body || {};
  if (!action || !candidateId) {
    return res.status(400).json({ error: "Missing action or candidateId" });
  }
  if (action !== "approve" && action !== "dismiss") {
    return res.status(400).json({ error: "action must be 'approve' or 'dismiss'" });
  }

  try {
    const rows = await d1(
      "SELECT * FROM rule_candidates WHERE id=? LIMIT 1",
      [candidateId]
    );
    if (!rows.length) return res.status(404).json({ error: "Candidate not found" });
    const candidate = rows[0];
    const now = new Date().toISOString();

    if (action === "approve") {
      if (!ruleText) return res.status(400).json({ error: "Missing ruleText for approve" });

      const ruleId = `${candidateId}_rule_${Date.now()}`;
      await d1(
        `INSERT INTO rules (id, metric_name, section, pattern_type, rule_text, source, candidate_id, created_at)
         VALUES (?,?,?,?,?,?,?,?)`,
        [
          ruleId,
          candidate.metric_name,
          candidate.section || null,
          candidate.pattern_type,
          ruleText,
          "user_approved",
          candidateId,
          now,
        ]
      );

      await d1(
        "UPDATE rule_candidates SET status='approved', updated_at=? WHERE id=?",
        [now, candidateId]
      );

      return res.status(200).json({ success: true, action, ruleId });
    }

    if (action === "dismiss") {
      const newCount = (candidate.dismissal_count || 0) + 1;

      if (newCount >= 5) {
        await d1(
          "UPDATE rule_candidates SET dismissal_count=?, status='retired', updated_at=? WHERE id=?",
          [newCount, now, candidateId]
        );
      } else {
        await d1(
          "UPDATE rule_candidates SET dismissal_count=?, occurrences_since_last_dismissal=0, updated_at=? WHERE id=?",
          [newCount, now, candidateId]
        );
      }

      return res.status(200).json({ success: true, action, dismissal_count: newCount });
    }
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
