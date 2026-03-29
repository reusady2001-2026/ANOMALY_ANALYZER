// ══════════════════════════════════════════════════════════════
// SECTION: Asset Management Anomaly Engine (T3 methodology)
// ══════════════════════════════════════════════════════════════
//
// Detects ONLY material anomalies — those that shift the Cap Rate
// by ≥ 10 basis points (purchase_price × 0.001 annually).
//
// Continuous metrics: T3 rolling comparison method
// Sporadic metrics:   Z-Score + cap-rate impact dual filter
//
// Returns results in the same structure as analyze() so all
// existing rendering code (renderAnalyzer, renderComp, export)
// works without modification.
// ══════════════════════════════════════════════════════════════

function analyzeAsset(name, allV, months, isInc, pp, skip) {
  if (skip === undefined) skip = SKIP;

  const matTh = pp * 0.001; // 10bps annual cap rate impact threshold
  const ae = allV.length - skip;
  const vals = allV.slice(0, ae);

  if (!vals.length || allZ(vals)) return null;
  const cl = classify(vals);
  if (cl.t === "skip") return null;

  const { t: mt, oi } = cl;
  const cv = mt === "continuous" ? vals.slice(oi) : vals;
  const nv = normVol(vals, mt === "continuous" ? oi : 0);

  // Build base result array — skip/pre cells get their markers,
  // all other cells start as "norm" (no anomaly)
  const res = [];
  for (let i = 0; i < allV.length; i++) {
    const v = allV[i];
    if (i >= ae) {
      res.push({ mi: i, v, z: null, st: "skip", at: null, mat: false, seas: false, recur: false, zm: null, chv: null });
      continue;
    }
    if (mt === "continuous" && i < oi) {
      res.push({ mi: i, v, z: null, st: "pre", at: null, mat: false, seas: false, recur: false, zm: null, chv: null });
      continue;
    }
    res.push({ mi: i, v, z: null, st: "norm", at: null, mat: false, seas: false, recur: false, zm: null, chv: null });
  }

  if (mt === "continuous") {
    // ── T3 METHOD ────────────────────────────────────────────
    // T3   = (V_n + V_{n-1} + V_{n-2}) × 4  (annualized 3-month sum)
    // T3-1 = (V_{n-1} + V_{n-2} + V_{n-3}) × 4
    // Material anomaly when |T3 - T3-1| ≥ matTh
    // Requires 4 data points from oi onwards (n, n-1, n-2, n-3)
    for (let n = oi + 3; n < ae; n++) {
      const T3  = (vals[n]   + vals[n-1] + vals[n-2]) * 4;
      const T31 = (vals[n-1] + vals[n-2] + vals[n-3]) * 4;
      const diff = T3 - T31;
      if (Math.abs(diff) >= matTh) {
        // Positive = good for P&L:
        //   income metric that grew  (diff > 0) → pos
        //   expense metric that fell (diff < 0) → pos
        const at = isInc ? (diff > 0 ? "pos" : "neg") : (diff < 0 ? "pos" : "neg");
        res[n].st   = "anom";
        res[n].mat  = true;
        res[n].at   = at;
        res[n].zm   = "t3";
        res[n].chv  = diff;
        res[n].z    = diff / matTh; // stored as ratio (how many thresholds away)
      }
    }
  } else {
    // ── SPORADIC Z-SCORE METHOD ───────────────────────────────
    // Both conditions must hold (strict greater-than for Z):
    //   1. |Z| > dynamic threshold
    //   2. |value| × 12 ≥ matTh  (annual cap-rate impact ≥ 10bps)
    const m  = mn(cv);
    const s  = sdev(cv);
    const th = thresh(mt, cv, nv);
    if (s > 0) {
      for (let i = 0; i < ae; i++) {
        if (res[i].st === "pre" || res[i].st === "skip") continue;
        const v = allV[i];
        const z = (v - m) / s;
        const capImpact = Math.abs(v) * 12;
        if (Math.abs(z) > th && capImpact >= matTh) {
          const at = isInc ? (z > 0 ? "pos" : "neg") : (z > 0 ? "neg" : "pos");
          res[i].st  = "anom";
          res[i].mat = true;
          res[i].at  = at;
          res[i].zm  = "val";
          res[i].z   = z;
        }
      }
    }
  }

  // Trend (same calculation as operational analyze())
  const tc = [];
  const ts = mt === "continuous" ? oi : 0;
  for (let i = ts; i < ae; i++) tc.push(i === ts ? 0 : vals[i] - vals[i-1]);
  const tAll = tc.reduce((a, b) => a + b, 0);
  const t12  = tc.slice(-12).reduce((a, b) => a + b, 0);
  const t3c  = tc.slice(-3).reduce((a, b) => a + b, 0);

  return {
    name, mt, oi, th: matTh, nv, res,
    tr: { all: tAll, m12: t12, m3: t3c },
    sq: null, wq: null, isInc, sec: isInc ? "income" : "expense"
  };
}
