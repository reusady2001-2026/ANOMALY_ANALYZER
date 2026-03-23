// ============================================================
// ENRICHMENT.JS — Post-rule enrichment with real-world data
// Works with 12 API sources from context.js
// Adds narrative context, confidence notes, data sources list
// ============================================================

const Enrichment = (() => {

  const MO = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  // ── MONTH UTILITIES ───────────────────────────────────

  function parseLabel(label) {
    if (!label) return null;
    const p = String(label).split(' ');
    const m = MO.indexOf(p[0]);
    const y = parseInt(p[1]);
    if (m < 0 || isNaN(y)) return null;
    return { month: m, year: y, quarter: Math.floor(m / 3) + 1 };
  }

  function prevLabel(label) {
    const p = parseLabel(label);
    if (!p) return null;
    let { month, year } = p;
    month--;
    if (month < 0) { month = 11; year--; }
    return `${MO[month]} ${year}`;
  }

  function yrAgoLabel(label) {
    const p = parseLabel(label);
    if (!p) return null;
    return `${MO[p.month]} ${p.year - 1}`;
  }

  function sg(obj, ...path) {
    let v = obj;
    for (const k of path) { if (!v) return null; v = v[k]; }
    return v ?? null;
  }

  // ── FORMAT HELPERS ────────────────────────────────────

  function sign(n) { return n >= 0 ? '+' : ''; }
  function pct(n)  { return `${sign(n)}${n.toFixed(1)}%`; }
  function bps(n)  { return `${Math.abs(n)}bps`; }

  // ── BUILD MONTH SNAPSHOT ──────────────────────────────
  // Extracts all relevant data points for a single month

  function monthSnapshot(ctx, label) {
    if (!ctx || !label) return { label };
    const p = parseLabel(label);
    if (!p) return { label };
    const { month, year, quarter } = p;

    // ── FRED data ──
    const fedfunds     = sg(ctx,'fred','fedfunds',label);
    const fedfundsPrev = sg(ctx,'fred','fedfunds',prevLabel(label));
    const fedChangeBps = (fedfunds != null && fedfundsPrev != null)
      ? Math.round((fedfunds - fedfundsPrev) * 100) : null;

    const cpiNow   = sg(ctx,'fred','cpi',label);
    const cpiYrAgo = sg(ctx,'fred','cpi',yrAgoLabel(label));
    const cpiYoY   = (cpiNow != null && cpiYrAgo != null && cpiYrAgo !== 0)
      ? ((cpiNow - cpiYrAgo) / Math.abs(cpiYrAgo)) * 100 : null;

    const rentNow   = sg(ctx,'fred','rentCPI',label);
    const rentYrAgo = sg(ctx,'fred','rentCPI',yrAgoLabel(label));
    const rentYoY   = (rentNow != null && rentYrAgo != null && rentYrAgo !== 0)
      ? ((rentNow - rentYrAgo) / Math.abs(rentYrAgo)) * 100 : null;

    const stateUR      = sg(ctx,'fred','stateUR',label);
    const mortgage30   = sg(ctx,'fred','mortgage30',label);
    const housingStarts = sg(ctx,'fred','housingStarts',label);

    // ── FEMA ──
    const qStart = new Date(year, (quarter - 1) * 3, 1);
    const qEnd   = new Date(year, quarter * 3, 0);
    const threeMonthsAgo = new Date(year, month - 3, 1);
    const thisMonthStart = new Date(year, month, 1);

    const femaQuarter = (ctx.fema || []).filter(d => {
      const dt = new Date(d.date + 'T00:00:00');
      return dt >= qStart && dt <= qEnd;
    });
    const femaRecent = (ctx.fema || []).filter(d => {
      const dt = new Date(d.date + 'T00:00:00');
      return dt >= threeMonthsAgo && dt <= thisMonthStart;
    });

    // ── Legislation ──
    const billsYear = (ctx.congress || []).filter(b => (b.introduced || '').startsWith(String(year)));
    const stateBillsYear = (ctx.openStates || []).filter(b => (b.introduced || '').startsWith(String(year)));

    // ── Weather (Open-Meteo) ──
    const weather = sg(ctx,'weather',label) || {};

    // ── Climate (NCDC) ──
    const climate = sg(ctx,'climate',label) || {};

    // ── Energy (EIA) ──
    const electricityPrice = sg(ctx,'eia','electricityPrice',label);
    const electricityPrev  = sg(ctx,'eia','electricityPrice',prevLabel(label));
    const gasPrice         = sg(ctx,'eia','gasPrice',label);
    const gasPrev          = sg(ctx,'eia','gasPrice',prevLabel(label));

    // ── BLS ──
    const regionalCPI    = sg(ctx,'bls','regionalCPI',label);
    const housingCPI     = sg(ctx,'bls','housingCPI',label);
    const electricityCPI = sg(ctx,'bls','electricityCPI',label);
    const gasCPI         = sg(ctx,'bls','gasCPI',label);
    const constructionPPI = sg(ctx,'bls','constructionPPI',label);
    const constructionPPIPrev = sg(ctx,'bls','constructionPPI',prevLabel(label));

    // ── Building Permits ──
    const permits     = sg(ctx,'buildingPermits',String(year));
    const permitsPrev = sg(ctx,'buildingPermits',String(year - 1));

    // ── NWS Alerts ──
    const nwsAlerts = ctx.nwsAlerts || [];

    return {
      label, month, year, quarter,
      fedfunds, fedfundsPrev, fedChangeBps,
      cpiYoY, cpiNow,
      rentYoY,
      stateUR, mortgage30, housingStarts,
      femaQuarter, femaRecent,
      billsYear, stateBillsYear,
      weather, climate,
      electricityPrice, electricityPrev, gasPrice, gasPrev,
      regionalCPI, housingCPI, electricityCPI, gasCPI,
      constructionPPI, constructionPPIPrev,
      permits, permitsPrev,
      nwsAlerts,
    };
  }

  // ── ENRICHED PRIMARY TEXT ─────────────────────────────

  function buildEnrichedPrimary(result, snap, ctx) {
    const base = result.primary?.label || '';
    const city = ctx?.city || '';
    const st   = ctx?.stateAbbr || '';
    const loc  = [city, st].filter(Boolean).join(', ');

    let text = loc ? `${base} — ${loc} (${snap.label}).` : `${base} (${snap.label}).`;
    const bullets = [];

    // ── CPI ──
    if (snap.cpiYoY != null) {
      if (snap.cpiYoY > 5)
        bullets.push(`National CPI at ${pct(snap.cpiYoY)} YoY — elevated inflation amplifying cost pressures.`);
      else if (snap.cpiYoY > 2.5 && result.section === 'EXPENSES')
        bullets.push(`National CPI at ${pct(snap.cpiYoY)} YoY — moderate inflationary headwinds.`);
      else if (snap.cpiYoY < 1.5 && result.section === 'EXPENSES')
        bullets.push(`CPI only ${pct(snap.cpiYoY)} YoY — inflation alone unlikely to explain this spike.`);
    }

    // ── Fed funds ──
    if (snap.fedChangeBps != null && Math.abs(snap.fedChangeBps) >= 25) {
      const dir = snap.fedChangeBps > 0 ? 'raised' : 'cut';
      bullets.push(`Fed ${dir} rates ${bps(snap.fedChangeBps)} to ${snap.fedfunds?.toFixed(2) ?? '?'}% — ${snap.fedChangeBps > 0 ? 'increasing' : 'easing'} financing costs.`);
    } else if (snap.fedfunds != null && snap.fedfunds > 5.0) {
      bullets.push(`Fed funds elevated at ${snap.fedfunds.toFixed(2)}% — meaningful drag on leveraged assets.`);
    }

    // ── Rent CPI ──
    if (snap.rentYoY != null && result.section === 'INCOME') {
      if (snap.rentYoY > 4)
        bullets.push(`Rent CPI at ${pct(snap.rentYoY)} YoY — rents rising nationally, making shortfall asset-specific.`);
      else if (snap.rentYoY < 0)
        bullets.push(`Rent CPI at ${pct(snap.rentYoY)} YoY — softening rental market contributing to pressure.`);
    }

    // ── State unemployment ──
    if (snap.stateUR != null) {
      if (snap.stateUR < 3.5)
        bullets.push(`${ctx?.stateName || st} unemployment ${snap.stateUR.toFixed(1)}% — tight labor market, strong demand backdrop.`);
      else if (snap.stateUR > 5.5)
        bullets.push(`${ctx?.stateName || st} unemployment ${snap.stateUR.toFixed(1)}% — weak labor market may suppress demand.`);
    }

    // ── FEMA ──
    if (snap.femaRecent?.length > 0) {
      const d = snap.femaRecent[0];
      bullets.push(`FEMA ${d.type || 'disaster'} declaration in ${st} (${d.date}) — potential disruption.`);
    } else if (snap.femaQuarter?.length > 0) {
      const d = snap.femaQuarter[0];
      bullets.push(`FEMA ${d.type || 'disaster'} in ${st} same quarter (${d.date}).`);
    }

    // ── Weather ──
    if (snap.weather.totalSnow > 20)
      bullets.push(`${snap.weather.totalSnow.toFixed(0)}cm snowfall recorded in ${snap.label}.`);
    if (snap.weather.avgTemp != null && snap.weather.avgTemp < -5)
      bullets.push(`Average temperature ${snap.weather.avgTemp.toFixed(1)}°C — extreme cold period.`);
    if (snap.weather.avgTemp != null && snap.weather.avgTemp > 30)
      bullets.push(`Average temperature ${snap.weather.avgTemp.toFixed(1)}°C — extreme heat driving cooling demand.`);
    if (snap.weather.totalPrecip > 200)
      bullets.push(`${snap.weather.totalPrecip.toFixed(0)}mm precipitation — heavy rainfall period.`);

    // ── Energy prices ──
    if (snap.electricityPrice != null && snap.electricityPrev != null && snap.electricityPrice > snap.electricityPrev * 1.05)
      bullets.push(`State electricity price up ${pct(((snap.electricityPrice/snap.electricityPrev)-1)*100)} vs prior month.`);
    if (snap.gasPrice != null && snap.gasPrev != null && snap.gasPrice > snap.gasPrev * 1.08)
      bullets.push(`State natural gas price up ${pct(((snap.gasPrice/snap.gasPrev)-1)*100)} vs prior month.`);

    // ── Construction costs ──
    if (snap.constructionPPI != null && snap.constructionPPIPrev != null && snap.constructionPPI > snap.constructionPPIPrev * 1.02)
      bullets.push(`Multifamily construction PPI up ${pct(((snap.constructionPPI/snap.constructionPPIPrev)-1)*100)} — rising construction/repair costs.`);

    // ── Building permits ──
    if (snap.permits != null && snap.permitsPrev != null && snap.permits > snap.permitsPrev * 1.15)
      bullets.push(`Building permits up ${pct(((snap.permits/snap.permitsPrev)-1)*100)} YoY in state — new supply pipeline.`);

    // ── Legislation ──
    if (snap.stateBillsYear?.length > 0) {
      const b = snap.stateBillsYear[0];
      bullets.push(`State legislation: "${b.title.slice(0, 70)}" (${snap.year}).`);
    } else if (snap.billsYear?.length > 0 && result.section === 'EXPENSES') {
      const b = snap.billsYear[0];
      bullets.push(`Federal bill: ${b.number} — "${b.title.slice(0, 60)}" (${b.introduced}).`);
    }

    // ── Mortgage ──
    if (snap.mortgage30 != null && snap.mortgage30 > 6.5)
      bullets.push(`30yr mortgage at ${snap.mortgage30.toFixed(2)}% — elevated rates constraining purchase demand.`);

    if (bullets.length > 0) text += '\n\n' + bullets.join('\n');
    return text;
  }

  // ── ENRICHED ALTERNATIVES ─────────────────────────────

  function buildEnrichedAlternatives(result, snap, ctx) {
    const alts = result.alternatives || [];
    return alts.map((alt, i) => {
      if (i === 0 && snap.stateUR != null)
        return `${alt} (${ctx?.stateName || ''} unemployment: ${snap.stateUR.toFixed(1)}%)`;
      if (i === 1 && snap.cpiYoY != null && Math.abs(snap.cpiYoY) > 2)
        return `${alt} — CPI ${pct(snap.cpiYoY)} YoY`;
      if (i === 2 && snap.weather.totalSnow > 10)
        return `${alt} — ${snap.weather.totalSnow.toFixed(0)}cm snow recorded`;
      if (i === 2 && snap.femaQuarter?.length > 0)
        return `${alt} — FEMA ${snap.femaQuarter[0].type} declaration (${snap.femaQuarter[0].date})`;
      return alt;
    });
  }

  // ── CONFIDENCE — TIER-BASED ───────────────────────────
  // No arbitrary weights. Confidence derived from:
  // - Which tier the primary rule came from
  // - How many API data points corroborate
  // - Any contradictions found

  function assessConfidence(result, snap) {
    const tier = result.topTier || 4;
    const notes = [];

    // Base confidence from tier
    let conf;
    if (tier === 1) conf = 80;      // API-verified fact
    else if (tier === 2) conf = 60;  // Metric-specific
    else if (tier === 3) conf = 45;  // Pattern
    else conf = 30;                   // Generic

    // ── Boosts (corroborating data) ──

    if (result.section === 'EXPENSES' && snap.cpiYoY != null && snap.cpiYoY > 4) {
      conf = Math.min(95, conf + 10);
      notes.push({ delta: +10, text: `CPI ${pct(snap.cpiYoY)} YoY corroborates cost pressure` });
    }

    if (snap.fedChangeBps != null && snap.fedChangeBps >= 50) {
      conf = Math.min(95, conf + 10);
      notes.push({ delta: +10, text: `Fed rate hike of ${bps(snap.fedChangeBps)} corroborates` });
    }

    if (snap.femaRecent?.length > 0 || snap.femaQuarter?.length > 0) {
      conf = Math.min(95, conf + 10);
      notes.push({ delta: +10, text: `FEMA disaster declaration in state corroborates` });
    }

    if (snap.weather.totalSnow > 20 && result.firedRuleIds?.some(id => /SNOW|WINTER|COLD/i.test(id))) {
      conf = Math.min(95, conf + 10);
      notes.push({ delta: +10, text: `${snap.weather.totalSnow.toFixed(0)}cm snowfall confirms weather cause` });
    }

    if (snap.weather.avgTemp > 30 && result.firedRuleIds?.some(id => /HEAT|SUMMER|COOL|ELEC/i.test(id))) {
      conf = Math.min(95, conf + 10);
      notes.push({ delta: +10, text: `Extreme heat (${snap.weather.avgTemp.toFixed(1)}°C avg) confirms cooling cause` });
    }

    if (snap.electricityPrice && snap.electricityPrev && snap.electricityPrice > snap.electricityPrev * 1.05 &&
        result.firedRuleIds?.some(id => /ELEC|ENERGY|UTIL/i.test(id))) {
      conf = Math.min(95, conf + 8);
      notes.push({ delta: +8, text: `State electricity price increase confirms utility cause` });
    }

    const hasLeg = (snap.stateBillsYear?.length || 0) + (snap.billsYear?.length || 0) > 0;
    if (hasLeg && result.firedRuleIds?.some(id => /POL|TAX|REG|LEGIS/i.test(id))) {
      conf = Math.min(95, conf + 10);
      notes.push({ delta: +10, text: `Active legislation corroborates regulatory cause` });
    }

    // Multiple corroborations
    const boostCount = notes.filter(n => n.delta > 0).length;
    if (boostCount >= 3) {
      conf = Math.min(95, conf + 5);
      notes.push({ delta: +5, text: `${boostCount} independent sources corroborate` });
    }

    // ── Reductions (contradictions) ──

    if (result.section === 'EXPENSES' && snap.cpiYoY != null && snap.cpiYoY < 1.5 && snap.cpiYoY >= 0 &&
        result.firedRuleIds?.some(id => /CPI|INFLATION/i.test(id))) {
      conf = Math.max(10, conf - 15);
      notes.push({ delta: -15, text: `CPI only ${pct(snap.cpiYoY)} contradicts inflation-driven cause` });
    }

    if (snap.stateUR != null && snap.stateUR < 3.5 &&
        result.firedRuleIds?.some(id => /UNEMPLOY|VACANCY|RESI.*SHORT/i.test(id)) && result.pnl === 'loss') {
      conf = Math.max(10, conf - 10);
      notes.push({ delta: -10, text: `Low unemployment (${snap.stateUR.toFixed(1)}%) contradicts demand weakness` });
    }

    // Cap label
    let confLabel;
    if (conf >= 75) confLabel = 'high';
    else if (conf >= 50) confLabel = 'medium';
    else confLabel = 'low';

    return { adjustedConfidence: conf, confidenceLabel: confLabel, confidenceNotes: notes };
  }

  // ── DATA SOURCES LIST ─────────────────────────────────

  function buildDataSources(snap, ctx) {
    const out = [];

    if (snap.fedfunds != null) out.push({
      label: 'FRED — Federal Funds Rate', value: `${snap.fedfunds.toFixed(2)}%`, period: snap.label,
      note: snap.fedChangeBps != null ? `${snap.fedChangeBps > 0 ? '+' : ''}${snap.fedChangeBps}bps vs prior` : null });

    if (snap.cpiYoY != null) out.push({
      label: 'FRED — CPI (CPIAUCSL)', value: `${pct(snap.cpiYoY)} YoY`, period: snap.label });

    if (snap.rentYoY != null) out.push({
      label: 'FRED — Rent CPI', value: `${pct(snap.rentYoY)} YoY`, period: snap.label });

    if (snap.stateUR != null) out.push({
      label: `FRED — ${ctx?.stateName || ''} Unemployment`, value: `${snap.stateUR.toFixed(1)}%`, period: snap.label });

    if (snap.mortgage30 != null) out.push({
      label: 'FRED — 30yr Mortgage', value: `${snap.mortgage30.toFixed(2)}%`, period: snap.label });

    if (snap.housingStarts != null) out.push({
      label: 'FRED — Housing Starts', value: `${snap.housingStarts.toLocaleString()}K`, period: snap.label });

    // Weather
    if (snap.weather.avgTemp != null) out.push({
      label: 'Open-Meteo — Avg Temperature', value: `${snap.weather.avgTemp.toFixed(1)}°C`, period: snap.label });
    if (snap.weather.totalSnow > 0) out.push({
      label: 'Open-Meteo — Snowfall', value: `${snap.weather.totalSnow.toFixed(0)}cm`, period: snap.label });
    if (snap.weather.totalPrecip > 0) out.push({
      label: 'Open-Meteo — Precipitation', value: `${snap.weather.totalPrecip.toFixed(0)}mm`, period: snap.label });

    // Energy
    if (snap.electricityPrice != null) out.push({
      label: `EIA — ${ctx?.stateName || ''} Electricity Price`, value: `${snap.electricityPrice.toFixed(1)}¢/kWh`, period: snap.label });
    if (snap.gasPrice != null) out.push({
      label: `EIA — ${ctx?.stateName || ''} Natural Gas`, value: `$${snap.gasPrice.toFixed(2)}/MCF`, period: snap.label });

    // BLS
    if (snap.constructionPPI != null) out.push({
      label: 'BLS — Multifamily Construction PPI', value: snap.constructionPPI.toFixed(1), period: snap.label });

    // NCDC
    if (snap.climate?.heatingDegreeDays != null) out.push({
      label: 'NCDC — Heating Degree Days', value: snap.climate.heatingDegreeDays.toFixed(0), period: snap.label });
    if (snap.climate?.coolingDegreeDays != null) out.push({
      label: 'NCDC — Cooling Degree Days', value: snap.climate.coolingDegreeDays.toFixed(0), period: snap.label });

    // FEMA
    if (snap.femaQuarter?.length) {
      snap.femaQuarter.slice(0, 3).forEach(d => out.push({
        label: `FEMA — ${d.type || 'Disaster'} #${d.number}`, value: d.title.slice(0, 50), period: d.date }));
    }

    // Building Permits
    if (snap.permits != null) out.push({
      label: 'Census — Building Permits (State)', value: snap.permits.toLocaleString(), period: String(snap.year) });

    // Census
    const cen = ctx?.census || {};
    if (cen.population) out.push({ label: 'Census — City Population', value: cen.population.toLocaleString(), period: '2022 est.' });
    if (cen.medianIncome) out.push({ label: 'Census — Median Income', value: `$${cen.medianIncome.toLocaleString()}`, period: '2022 est.' });
    if (cen.renterRatio) out.push({ label: 'Census — Renter Ratio', value: `${(cen.renterRatio * 100).toFixed(0)}%`, period: '2022 est.' });

    // HUD
    const hud = ctx?.hud || {};
    if (hud.year && hud.rows?.length) out.push({
      label: 'HUD — Fair Market Rents', value: `${hud.rows.length} metro areas`, period: String(hud.year) });

    // Congress
    if (snap.billsYear?.length) snap.billsYear.slice(0, 2).forEach(b => out.push({
      label: `Congress — ${b.number}`, value: b.title.slice(0, 60), period: b.introduced }));

    // OpenStates
    if (snap.stateBillsYear?.length) snap.stateBillsYear.slice(0, 2).forEach(b => out.push({
      label: `OpenStates — ${ctx?.stateName || ''} Bill`, value: b.title.slice(0, 60), period: b.introduced || String(snap.year) }));

    return out;
  }

  // ── CORROBORATING NOTE ────────────────────────────────

  function buildCorroboratingNote(corroborating, snap) {
    if (!corroborating || corroborating.length === 0) return null;
    const sameQ = corroborating.filter(c => {
      const cp = parseLabel(c.monthLabel || '');
      return cp && cp.year === snap.year && cp.quarter === snap.quarter;
    });
    if (sameQ.length === 0) return null;

    const total = sameQ.length + 1;
    if (snap.fedChangeBps != null && Math.abs(snap.fedChangeBps) >= 50)
      return `${total} anomalies in Q${snap.quarter} ${snap.year} when Fed moved ${bps(snap.fedChangeBps)} — portfolio-wide financing impact.`;
    if (snap.cpiYoY != null && snap.cpiYoY > 4)
      return `${total} anomalies coincide with ${pct(snap.cpiYoY)} CPI in Q${snap.quarter} ${snap.year} — macro inflation signal.`;
    if (snap.femaQuarter?.length)
      return `${total} anomalies coincide with FEMA ${snap.femaQuarter[0].type} in Q${snap.quarter} ${snap.year} — shared disruption.`;
    if (snap.weather.totalSnow > 30)
      return `${total} anomalies during heavy snow month (${snap.weather.totalSnow.toFixed(0)}cm) — weather-driven cluster.`;
    return `${total} anomalies share similar rule patterns in Q${snap.quarter} ${snap.year}.`;
  }

  // ── ENRICH ONE RESULT ─────────────────────────────────

  function enrichOne(result, ctx) {
    if (!ctx || !result) return result;

    const snap = monthSnapshot(ctx, result.monthLabel);
    const hasData = snap.fedfunds != null || snap.cpiYoY != null ||
                    snap.stateUR != null || snap.femaRecent?.length ||
                    snap.weather?.avgTemp != null || snap.electricityPrice != null;

    const enrichedPrimary      = hasData ? buildEnrichedPrimary(result, snap, ctx) : null;
    const enrichedAlternatives = hasData ? buildEnrichedAlternatives(result, snap, ctx) : null;
    const { adjustedConfidence, confidenceLabel, confidenceNotes } = assessConfidence(result, snap);
    const dataSources       = buildDataSources(snap, ctx);
    const corroboratingNote = buildCorroboratingNote(result.corroborating, snap);

    return {
      ...result,
      enrichedPrimary,
      enrichedAlternatives,
      adjustedConfidence,
      confidenceLabel,
      confidenceNotes,
      dataSources,
      corroboratingNote,
    };
  }

  // ── ENRICH ALL ────────────────────────────────────────

  function enrichAll(engineResult, ruleResults, dataContext) {
    if (!ruleResults || !ruleResults.results) return ruleResults;
    const enriched = ruleResults.results.map(r => enrichOne(r, dataContext));

    // Update metric.reasonData in-place
    if (engineResult) {
      enriched.forEach(er => {
        const metric = (engineResult.metrics || []).find(m => m.id === er.metricId);
        if (metric && metric.reasonData) {
          metric.reasonData[er.monthIdx] = er;
        }
      });
    }

    return { ...ruleResults, results: enriched };
  }

  // ── PUBLIC ────────────────────────────────────────────
  return { enrichOne, enrichAll };

})();
