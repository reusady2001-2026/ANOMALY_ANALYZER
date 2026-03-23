module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "Missing url param" });

  // Extra headers passed from client (for APIs requiring auth headers)
  let extraHeaders = {};
  if (req.query.h) {
    try { extraHeaders = JSON.parse(req.query.h); } catch {}
  }

  const targetHeaders = { "Content-Type": "application/json", ...extraHeaders };
  const options = { method: req.method, headers: targetHeaders };

  if (req.method === "POST" && req.body) {
    // _proxyHeaders injected into body for POST APIs needing custom headers
    const { _proxyHeaders, ...rest } = req.body;
    if (_proxyHeaders) Object.assign(targetHeaders, _proxyHeaders);
    options.body = JSON.stringify(rest);
  }

  try {
    const r = await fetch(url, options);
    const text = await r.text();
    res.status(r.status);
    try { res.json(JSON.parse(text)); }
    catch { res.send(text); }
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
};
