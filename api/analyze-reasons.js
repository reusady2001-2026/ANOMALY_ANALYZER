export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).json({});
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
 
  const API_KEY = process.env.ANOMALY_ANALYZER;
  if (!API_KEY) return res.status(500).json({ error: "API key not configured" });
 
  const { mode, context, question, history, anomaly, propertyName, propertyType, city, state } = req.body;
 
  const loc = (city || "") + (city && state ? ", " : "") + (state || "");
 
  const base = `You are an expert real estate operational anomaly analyst embedded in a Z-Score anomaly detection system for US income-producing properties.
 
The system already detected anomalies statistically. You provide the WHY — causal reasoning using property context, location knowledge, and market intelligence.
 
Property: ${propertyName || "Not specified"} | Type: ${propertyType || "Multifamily Residential"} | Location: ${loc || "Not specified"}
 
You have deep knowledge of:
- US real estate by state/city: tax cycles, regulations, rent control, zoning
- Seasonal patterns: snow removal, HVAC, vacancy, lease renewal, academic cycles
- Operational events: tenant turnover, insurance renewal, tax reassessment, utility rates
- Market cycles: interest rates, supply/demand, construction pipelines
- Regulatory: state/municipal tax changes, compliance, environmental rules
 
RULES:
- Answer in the language the user writes in (Hebrew or English)
- Use exact numbers from data — never approximate
- Reference specific Z-Score, threshold, method when explaining anomalies
- Distinguish data analysis from external knowledge
- Consider ${city || "the city"}, ${state || "the state"} specifically — local climate, regulations, market
- If uncertain, say so`;
 
  let system, userMsg;
 
  if (mode === "explain") {
    system = base + `
 
TASK: Explain one specific anomaly. Consider:
1. What happened in ${loc} during the anomaly month? Climate, regulations, market events?
2. Seasonal patterns for this metric in this location?
3. Operational event? Lease, vendor, maintenance?
4. Regulatory? Tax, utility rate, compliance?
5. Connected to other anomalies in the dataset?
 
Respond ONLY in JSON:
{
  "primaryReason": {"category": "Seasonal|Operational|Regulatory|Market|Data|Asset-Specific", "explanation": "detailed", "confidence": "high|medium|low"},
  "alternatives": [{"category": "cat", "explanation": "exp"}, {"category": "cat", "explanation": "exp"}, {"category": "cat", "explanation": "exp"}],
  "scope": "asset-specific|market-wide|data-related",
  "relatedAnomalies": "connections to other anomalies",
  "recommendation": "what to investigate",
  "localContext": "what was happening in ${loc} during this period"
}`;
    userMsg = `Dataset:\n${context}\n\nExplain this anomaly:\n${JSON.stringify(anomaly)}`;
  } else {
    system = base + `
 
TASK: Answer the user's question about the data. You can calculate, compare, explain detection logic, identify patterns, and bring local market context for ${loc}. Be precise and data-driven.`;
    userMsg = `Dataset:\n${context}\n\nQuestion: ${question}`;
  }
 
  const messages = [];
  if (history && history.length) {
    history.slice(-10).forEach(h => {
      messages.push({ role: h.role === "user" ? "user" : "assistant", content: h.content });
    });
  }
  messages.push({ role: "user", content: userMsg });
 
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 4000, system, messages })
    });
    if (!r.ok) { const e = await r.text(); return res.status(r.status).json({ error: e }); }
    const data = await r.json();
    const text = data.content?.[0]?.text || "";
    let result;
    if (mode === "explain") {
      try { const m = text.match(/\{[\s\S]*\}/); result = m ? JSON.parse(m[0]) : { raw: text }; }
      catch (e) { result = { raw: text }; }
    } else { result = { answer: text }; }
    return res.status(200).json(result);
  } catch (err) { return res.status(500).json({ error: err.message }); }
}
 
