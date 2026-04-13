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

// ── Pure functions (unchanged from OAAS) ─────────────────────────────────────

const ANGLE_TO_PATTERN = {
  "high_variance":        { patternType: "high_variance",        label: "High Variance" },
  "persistent_spike":     { patternType: "persistent_spike",     label: "Persistent Spike" },
  "persistent_drop":      { patternType: "persistent_drop",      label: "Persistent Drop" },
  "one_time_spike":       { patternType: "one_time_spike",       label: "One-Time Spike" },
  "one_time_drop":        { patternType: "one_time_drop",        label: "One-Time Drop" },
  "seasonal_spike":       { patternType: "seasonal_spike",       label: "Seasonal Spike" },
  "seasonal_drop":        { patternType: "seasonal_drop",        label: "Seasonal Drop" },
  "gradual_increase":     { patternType: "gradual_increase",     label: "Gradual Increase" },
  "gradual_decrease":     { patternType: "gradual_decrease",     label: "Gradual Decrease" },
  "structural_change_up": { patternType: "structural_change_up", label: "Structural Change Up" },
  "structural_change_dn": { patternType: "structural_change_dn", label: "Structural Change Down" },
};

function generateSuggestedRules(patternType, metricName, section) {
  const rules = [];
  const m = metricName || "this metric";
  const s = section || "general";

  switch (patternType) {
    case "high_variance":
      rules.push(`Flag when ${m} variance exceeds 2× the historical standard deviation`);
      rules.push(`Alert when month-over-month change in ${m} exceeds 20%`);
      break;
    case "persistent_spike":
      rules.push(`Investigate when ${m} remains elevated for 3+ consecutive months`);
      rules.push(`Escalate if ${m} spike in ${s} is not explained by occupancy or seasonality`);
      break;
    case "persistent_drop":
      rules.push(`Review when ${m} stays below baseline for 3+ consecutive months`);
      rules.push(`Escalate if persistent drop in ${m} coincides with occupancy decline`);
      break;
    case "one_time_spike":
      rules.push(`Verify one-time ${m} spike against invoices or special charges`);
      rules.push(`Document reason for outlier month in ${m} for ${s}`);
      break;
    case "one_time_drop":
      rules.push(`Verify one-time ${m} drop — check for missed billing or credit`);
      rules.push(`Confirm ${m} recovery in the following month`);
      break;
    case "seasonal_spike":
      rules.push(`Expect ${m} spike in recurring months — flag only if magnitude deviates >15%`);
      rules.push(`Compare seasonal ${m} pattern year-over-year for ${s}`);
      break;
    case "seasonal_drop":
      rules.push(`Expect ${m} drop in recurring months — flag only if magnitude deviates >15%`);
      rules.push(`Compare seasonal ${m} pattern year-over-year for ${s}`);
      break;
    case "gradual_increase":
      rules.push(`Monitor ${m} trend — flag if 6-month slope exceeds historical average by 30%`);
      rules.push(`Review contract or utility pricing for ${m} in ${s}`);
      break;
    case "gradual_decrease":
      rules.push(`Monitor ${m} trend — flag if 6-month decline indicates structural revenue loss`);
      rules.push(`Review occupancy and lease terms for ${m} impact in ${s}`);
      break;
    case "structural_change_up":
      rules.push(`Document reason for permanent step-change up in ${m}`);
      rules.push(`Update budget baseline for ${m} in ${s} to reflect new level`);
      break;
    case "structural_change_dn":
      rules.push(`Document reason for permanent step-change down in ${m}`);
      rules.push(`Update budget baseline for ${m} in ${s} to reflect new level`);
      break;
    default:
      rules.push(`Review ${m} anomaly pattern in ${s}`);
  }
  return rules;
}

function computeTypicalMonths(anomalyHistory) {
  if (!Array.isArray(anomalyHistory) || !anomalyHistory.length) return [];
  const counts = {};
  for (const entry of anomalyHistory) {
    const label = entry.monthLabel || entry.month_label;
    if (!label) continue;
    // Extract month name from labels like "Jan-2023" or "2023-01"
    let monthName = null;
    const m1 = label.match(/^([A-Za-z]{3})-?\d{4}$/);
    const m2 = label.match(/^\d{4}-(\d{2})$/);
    if (m1) monthName = m1[1];
    else if (m2) {
      const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      monthName = months[parseInt(m2[1], 10) - 1] || null;
    }
    if (monthName) counts[monthName] = (counts[monthName] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name);
}

function generateReason(patternType, typicalMonths, metricName) {
  const m = metricName || "this metric";
  const monthStr = typicalMonths && typicalMonths.length
    ? `typically in ${typicalMonths.join(", ")}`
    : "recurrently";

  switch (patternType) {
    case "high_variance":     return `${m} shows high variance ${monthStr}, suggesting inconsistent operations or billing.`;
    case "persistent_spike":  return `${m} spikes persistently ${monthStr}, indicating a sustained cost or revenue driver.`;
    case "persistent_drop":   return `${m} drops persistently ${monthStr}, which may signal a recurring structural issue.`;
    case "one_time_spike":    return `${m} had a one-time spike ${monthStr} — likely a non-recurring event worth documenting.`;
    case "one_time_drop":     return `${m} had a one-time drop ${monthStr} — verify no billing was missed.`;
    case "seasonal_spike":    return `${m} spikes seasonally ${monthStr} — expected pattern, monitor for deviations.`;
    case "seasonal_drop":     return `${m} drops seasonally ${monthStr} — expected pattern, monitor for deviations.`;
    case "gradual_increase":  return `${m} shows a gradual increase ${monthStr}, trending above historical baseline.`;
    case "gradual_decrease":  return `${m} shows a gradual decrease ${monthStr}, trending below historical baseline.`;
    case "structural_change_up": return `${m} had a permanent step-change upward ${monthStr} — baseline should be updated.`;
    case "structural_change_dn": return `${m} had a permanent step-change downward ${monthStr} — baseline should be updated.`;
    default:                  return `${m} shows an anomaly pattern ${monthStr}.`;
  }
}

function generatePatternDescription(patternType, metricName, distinctProperties) {
  const m = metricName || "this metric";
  const propStr = Array.isArray(distinctProperties) && distinctProperties.length
    ? ` across ${distinctProperties.length} propert${distinctProperties.length === 1 ? "y" : "ies"}`
    : "";
  const label = (ANGLE_TO_PATTERN[patternType] || {}).label || patternType;
  return `${label} pattern detected for ${m}${propStr}.`;
}

async function fetchContextForPattern(metricName, patternType) {
  // D1 equivalent: fetch existing candidate row
  const rows = await d1(
    "SELECT * FROM rule_candidates WHERE metric_name=? AND pattern_type=? LIMIT 1",
    [metricName, patternType]
  );
  if (!rows.length) return null;
  const row = rows[0];
  return {
    ...row,
    distinct_properties: safeParseJSON(row.distinct_properties, []),
    suggested_rules:     safeParseJSON(row.suggested_rules, []),
    anomaly_history:     safeParseJSON(row.anomaly_history, []),
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function safeParseJSON(str, fallback) {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch (e) { return fallback; }
}

function buildCandidateId(metricName, patternType, stateAbbr) {
  const base = `${metricName}__${patternType}`;
  return stateAbbr ? `${base}__${stateAbbr}` : base;
}

// ── Main handler ──────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (!process.env.CF_ACCOUNT_ID || !process.env.CF_D1_DATABASE_ID || !process.env.CF_API_TOKEN) {
    return res.status(500).json({ error: "Cloudflare D1 not configured" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { anomalies } = req.body || {};
  if (!Array.isArray(anomalies) || !anomalies.length) {
    return res.status(400).json({ error: "Missing anomalies array" });
  }

  try {
    const now = new Date().toISOString();
    const updated = [];

    for (const anomaly of anomalies) {
      const {
        metricName,
        section,
        patternType,
        propertyId,
        monthLabel,
        stateAbbr,
      } = anomaly;

      if (!metricName || !patternType) continue;

      const id = buildCandidateId(metricName, patternType, stateAbbr || null);

      // Fetch existing row
      const existing = await fetchContextForPattern(metricName, patternType);

      if (existing) {
        // Skip retired or over-dismissed candidates
        if (existing.status === "retired") continue;
        if ((existing.dismissal_count || 0) >= 5) continue;

        // Update existing row
        const distinctProps = existing.distinct_properties || [];
        if (propertyId && !distinctProps.includes(propertyId)) {
          distinctProps.push(propertyId);
        }

        const anomalyHistory = existing.anomaly_history || [];
        if (monthLabel) anomalyHistory.push({ monthLabel, propertyId: propertyId || null });

        const newTotal = (existing.total_occurrences || 0) + 1;
        const newSinceDismissal = (existing.occurrences_since_last_dismissal || 0) + 1;

        const typicalMonths = computeTypicalMonths(anomalyHistory);
        const suggestedRules = generateSuggestedRules(patternType, metricName, section);
        const patternDescription = generatePatternDescription(patternType, metricName, distinctProps);

        await d1(
          `UPDATE rule_candidates SET
             total_occurrences=?,
             occurrences_since_last_dismissal=?,
             distinct_properties=?,
             distinct_property_count=?,
             suggested_rules=?,
             anomaly_history=?,
             pattern_description=?,
             updated_at=?
           WHERE id=?`,
          [
            newTotal,
            newSinceDismissal,
            JSON.stringify(distinctProps),
            distinctProps.length,
            JSON.stringify(suggestedRules),
            JSON.stringify(anomalyHistory),
            patternDescription,
            now,
            id,
          ]
        );

        updated.push({ id, action: "updated", total_occurrences: newTotal });

      } else {
        // Insert new row
        const distinctProps = propertyId ? [propertyId] : [];
        const anomalyHistory = monthLabel
          ? [{ monthLabel, propertyId: propertyId || null }]
          : [];

        const typicalMonths = computeTypicalMonths(anomalyHistory);
        const suggestedRules = generateSuggestedRules(patternType, metricName, section);
        const patternDescription = generatePatternDescription(patternType, metricName, distinctProps);
        const reason = generateReason(patternType, typicalMonths, metricName);

        await d1(
          `INSERT OR REPLACE INTO rule_candidates
             (id, metric_name, section, pattern_type, pattern_description,
              total_occurrences, occurrences_since_last_dismissal,
              distinct_properties, distinct_property_count,
              status, dismissal_count, suggested_rules, anomaly_history,
              state_abbr, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            id,
            metricName,
            section || null,
            patternType,
            patternDescription,
            1,
            1,
            JSON.stringify(distinctProps),
            distinctProps.length,
            "candidate",
            0,
            JSON.stringify(suggestedRules),
            JSON.stringify(anomalyHistory),
            stateAbbr || null,
            now,
          ]
        );

        updated.push({ id, action: "inserted", total_occurrences: 1 });
      }
    }

    // Return only candidates that meet surfacing threshold (20+ occurrences, 3+ distinct properties)
    const surfaced = [];
    for (const u of updated) {
      const rows = await d1(
        "SELECT * FROM rule_candidates WHERE id=? LIMIT 1",
        [u.id]
      );
      if (!rows.length) continue;
      const row = rows[0];
      const distinctProps = safeParseJSON(row.distinct_properties, []);
      if ((row.total_occurrences || 0) >= 20 && distinctProps.length >= 3) {
        surfaced.push({
          ...row,
          distinct_properties: distinctProps,
          suggested_rules:     safeParseJSON(row.suggested_rules, []),
          anomaly_history:     safeParseJSON(row.anomaly_history, []),
        });
      }
    }

    return res.status(200).json({ ok: true, updated: updated.length, surfaced });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
