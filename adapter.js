// ============================================================
// ADAPTER.JS — Translates anomaly-analyzer output format
// to the format expected by rules.js and enrichment.js
// Run this ONCE after analyze() completes, before rules.analyse()
// ============================================================

const Adapter = (() => {

  /**
   * Convert a single metric from our format to rules-compatible format.
   *
   * OUR FORMAT (from analyze()):
   *   { name, mt, oi, th, nv, sec:'income'|'expense',
   *     res: [{ v, z, st, at, mat, seas, recur, zm, chv }],
   *     tr: {all, m12, m3}, sq, wq, isInc }
   *
   * RULES FORMAT (expected by RuleEngine.analyse()):
   *   { id, name, section:'INCOME'|'EXPENSES', type:'continuous'|'sporadic',
   *     openingIdx, threshold, values:[], zScores:[], anomalies:[],
   *     materialAnomalies:[], seasonalityMonths:[], recurringPatterns:[],
   *     displayMonths:[], displayValues:[], trends:{}, quarters:{},
   *     reasonData:{} }
   */
  function convertMetric(met, idx, months) {
    const section = met.sec === 'income' ? 'INCOME' : 'EXPENSES';
    const id = `${section}_${met.name}_${idx}`;

    // Build zScores array in the format rules expects
    const zScores = met.res.map((r, i) => {
      if (r.st === 'skip' || r.st === 'pre') {
        return { z1: null, z2: null, anomalyType: null, isAnomaly: false, isReversion: false, effectiveZ: 0, pnl: null };
      }

      const isAnomaly = r.st === 'anom' || r.st === 'seas';
      const effectiveZ = r.z || 0;

      // Determine pnl: profit = good for property, loss = bad
      let pnl = null;
      if (r.at === 'pos') pnl = 'profit';
      else if (r.at === 'neg') pnl = 'loss';

      return {
        z1: r.zm === 'ch' ? r.z : null,
        z2: r.zm === 'val' ? r.z : null,
        anomalyType: r.zm || null,  // 'ch' or 'val'
        isAnomaly,
        isReversion: false,  // reversions already handled — st would be 'norm'
        effectiveZ,
        pnl,
        // Extra fields our rules might use
        value: r.v,
        change: r.chv,
        isMaterial: r.mat,
        isSeasonal: r.seas || r.st === 'seas',
      };
    });

    // Build anomalies array (indices where anomaly detected)
    const anomalies = [];
    met.res.forEach((r, i) => {
      if (r.st === 'anom' || r.st === 'seas') anomalies.push(i);
    });

    // Material anomalies
    const materialAnomalies = [];
    met.res.forEach((r, i) => {
      if (r.mat) materialAnomalies.push(i);
    });

    // Seasonal months
    const seasonalityMonths = [];
    met.res.forEach((r, i) => {
      if (r.seas || r.st === 'seas') seasonalityMonths.push(i);
    });

    // Recurring patterns
    const recurringPatterns = [];
    met.res.forEach((r, i) => {
      if (r.recur) recurringPatterns.push(i);
    });

    // Display months (all month indices in order)
    const displayMonths = met.res.map((_, i) => i);

    // Values
    const values = met.res.map(r => r.v);

    // Trends
    const trends = {
      trend: met.tr?.all || 0,
      trend12m: met.tr?.m12 || 0,
      trend3m: met.tr?.m3 || 0,
      direction: (met.tr?.all || 0) > 0 ? 'positive' : (met.tr?.all || 0) < 0 ? 'negative' : 'flat',
    };

    // Quarters
    const quarters = {
      strongestQ: met.sq?.k || null,
      weakestQ: met.wq?.k || null,
    };

    return {
      id,
      name: met.name,
      section,
      type: met.mt,  // 'continuous' or 'sporadic'
      openingIdx: met.oi,
      threshold: met.th,
      normalizedVolatility: met.nv,
      values,
      zScores,
      anomalies,
      materialAnomalies,
      seasonalityMonths,
      recurringPatterns,
      displayMonths,
      displayValues: values,
      trends,
      quarters,
      reasonData: {},  // will be filled by RuleEngine.analyse()
    };
  }

  /**
   * Convert full RESULTS array from our analyzer to rules-compatible format.
   * @param {Array} results — our RESULTS array from analyze()
   * @param {string[]} months — month labels from sliced data
   * @returns {Array} — metrics in rules-compatible format
   */
  function convertAll(results, months) {
    return results.map((met, idx) => convertMetric(met, idx, months));
  }

  /**
   * Full pipeline: takes our analyze() output, runs rules + enrichment.
   * Returns enriched rule results without modifying the original RESULTS.
   *
   * @param {Array} results — RESULTS from our analyzer
   * @param {string[]} months — month labels
   * @param {Object} assetInfo — { type, location, city, state }
   * @param {Object} dataContext — from Context.fetchDataContext()
   * @returns {Object} — { results: [...enrichedResults], clusters: [...] }
   */
  function runReasonEngine(results, months, assetInfo, dataContext) {
    // Step 1: Convert our format to rules format
    const convertedMetrics = convertAll(results, months);

    // Step 2: Run rule engine
    const ruleResults = RuleEngine.analyse(convertedMetrics, months, assetInfo, dataContext);

    // Step 3: Enrich with real-world data
    const enriched = Enrichment.enrichAll(
      { metrics: convertedMetrics },
      ruleResults,
      dataContext
    );

    // Step 4: Map enriched results back to our metric names for easy lookup
    const lookupMap = {};  // key: "metricName|||monthIdx" -> enriched result
    enriched.results.forEach(r => {
      lookupMap[`${r.metricName}|||${r.monthIdx}`] = r;
    });

    return {
      results: enriched.results,
      clusters: enriched.clusters || ruleResults.clusters,
      lookup: lookupMap,
    };
  }

  return { convertMetric, convertAll, runReasonEngine };

})();
