export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return res.status(200).json({});
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
 
  const API_KEY = process.env.ANOMALY_ANALYZER;
  if (!API_KEY) {
    return res.status(500).json({ error: "API key not configured" });
  }
 
  const { mode, context, question, history, anomaly, propertyName, propertyType, location } = req.body;
 
  const baseContext = `You are an expert real estate analyst embedded in an operational anomaly detection system for income-producing properties (Multifamily, Commercial, Retail, Industrial).
 
You have access to the full analyzed dataset of this property. The data includes monthly income and expense line items, with the following analysis already performed on each metric:
- Classification: continuous (active every month) or sporadic (intermittent)
- Z-Score calculation: via change method (month-over-month delta) or value method (deviation from running mean)
- Dynamic threshold based on normalized volatility
- Anomaly detection: regular anomaly (Z exceeds threshold), material anomaly (moves CAP RATE by 10+ basis points), seasonal (matching pattern year-over-year), recurring pattern, or reversion
- Trends: total, 12-month, and 3-month
- Quarters: strongest and weakest
 
Property context:
- Name: ${propertyName || "Not specified"}
- Type: ${propertyType || "Multifamily Residential"}
- Location: ${location || "Not specified"}
 
IMPORTANT RULES:
- Answer in the same language the user writes in (Hebrew or English)
- When calculating or comparing data, use the exact numbers provided in the context
- When explaining why something is/isn't an anomaly, reference the specific Z-Score, threshold, and method
- When bringing external information (market trends, regulations, seasonality), clearly distinguish it from the data-based analysis
- Be precise with numbers - don't round unless asked to
- If you don't have enough information to answer, say so clearly`;
 
  let systemPrompt, userMessage;
 
  if (mode === "explain") {
    systemPrompt = baseContext + `
 
ADDITIONAL ROLE FOR ANOMALY EXPLANATION:
You are explaining why a specific anomaly occurred. Apply these rule categories:
 
Asset Type Rules - Match property type against anomaly direction and metric to identify type-specific causes (vacancy events for residential, e-commerce pressure for retail, logistics demand for industrial, etc.)
 
Location Rules - City center = market cycle amplification; Tourist areas = seasonal deviation; New development = absorption risk; Border regions = currency/trade sensitivity
 
Operational Rules - Sudden expense overshoot = emergency capex; Income deviation = lease/tenant event; Gradual expense increase = vendor escalation
 
Regulatory Rules - Income shortfall in rent-controlled markets = regulatory ceiling; Expense overshoot = new taxes, compliance costs
 
Market Rules - Multiple metrics same direction = systemic; Isolated anomaly with stable peers = asset-specific
 
Respond in JSON format:
{
  "primaryReason": { "category": "rule category", "explanation": "detailed explanation", "confidence": "high/medium/low" },
  "alternatives": [
    { "category": "category", "explanation": "explanation" },
    { "category": "category", "explanation": "explanation" },
    { "category": "category", "explanation": "explanation" }
  ],
  "scope": "asset-specific / market-wide / data-related",
  "relatedAnomalies": "description of other anomalies in the dataset that may be connected",
  "recommendation": "what the analyst should investigate or verify"
}`;
    userMessage = `Here is the full dataset context:\n${context}\n\nExplain this specific anomaly:\n${JSON.stringify(anomaly, null, 2)}`;
  } else {
    systemPrompt = baseContext + `
 
ADDITIONAL ROLE FOR CHAT:
You are a conversational analyst. The user will ask questions about the data - calculations, comparisons, explanations, trends, or anything else. Use the full dataset to answer accurately. You can also bring external knowledge about real estate markets, regulations, and operational patterns when relevant.
 
Keep answers focused and practical. Use numbers from the data. If the user asks to calculate something, show the calculation steps.`;
    userMessage = `Here is the full dataset context:\n${context}\n\nUser question: ${question}`;
  }
 
  const contents = [];
  if (history && history.length) {
    history.forEach(h => {
      contents.push({ role: h.role === "user" ? "user" : "model", parts: [{ text: h.content }] });
    });
  }
  contents.push({ role: "user", parts: [{ text: userMessage }] });
 
  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + API_KEY,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: contents,
          generationConfig: {
            temperature: mode === "explain" ? 0.2 : 0.4,
            maxOutputTokens: 4000,
            ...(mode === "explain" ? { responseMimeType: "application/json" } : {})
          }
        })
      }
    );
 
    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: err });
    }
 
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
 
    let result;
    if (mode === "explain") {
      try {
        result = JSON.parse(text.replace(/```json|```/g, "").trim());
      } catch (e) {
        result = { raw: text };
      }
    } else {
      result = { answer: text };
    }
 
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
