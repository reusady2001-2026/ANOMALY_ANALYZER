// ============================================================
// RULES.JS — Anomaly reason rule engine (deterministic)
// Hierarchy-based ranking: TIER 1 (API-verified fact) >
// TIER 2 (metric-specific) > TIER 3 (data pattern) > TIER 4 (generic)
// No arbitrary weights — ranking by tier, then by count within tier
// ============================================================

const RuleEngine = (() => {

  // ── HELPERS ───────────────────────────────────────────
  const mo = label => label ? label.split(' ')[0] : '';
  const yr = label => label ? parseInt(label.split(' ')[1]) : 0;
  const isWinter = m => /dec|jan|feb/i.test(m);
  const isSummer = m => /jun|jul|aug/i.test(m);
  const isSpring = m => /mar|apr|may/i.test(m);
  const isFall = m => /sep|oct|nov/i.test(m);
  const isQ4 = m => /oct|nov|dec/i.test(m);
  const isQ2 = m => /apr|may|jun/i.test(m);
  const isQ1 = m => /jan|feb|mar/i.test(m);
  const nm = (metric, ...pats) => pats.some(p => new RegExp(p, 'i').test(metric.name || ''));
  const sg = (obj, ...path) => { let v = obj; for (const k of path) { if (!v) return null; v = v[k]; } return v ?? null; };
  const MO_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const prevLabel = label => {
    if (!label) return null;
    const m = MO_ABBR.indexOf(mo(label)), y = yr(label);
    if (m === 0) return `Dec ${y-1}`;
    return `${MO_ABBR[m-1]} ${y}`;
  };
  const yoyLabel = label => {
    if (!label) return null;
    return `${mo(label)} ${yr(label)-1}`;
  };

  // ── TIER CONSTANTS ────────────────────────────────────
  const TIER1 = 1; // API-verified fact
  const TIER2 = 2; // Metric-specific match
  const TIER3 = 3; // Data pattern (cross-metric)
  const TIER4 = 4; // Generic (season, section, asset type)

  // ── RULE DEFINITIONS ──────────────────────────────────
  // ctx = { anomaly, metric, allMetrics, assetInfo, monthIdx, monthLabel, dataContext }

  const RULES = [

    // ═════════════════════════════════════════════════════
    // TIER 1: API-VERIFIED FACTS (15 rules)
    // Strongest — based on actual external data
    // ═════════════════════════════════════════════════════

    { id:'T1_HEAVY_SNOW', tier:TIER1, category:'weather',
      label:'Heavy snowfall recorded in area — directly explaining snow/ice removal costs',
      condition: ctx => {
        const w = sg(ctx.dataContext,'weather',ctx.monthLabel);
        return w && w.totalSnow > 20 && nm(ctx.metric,'snow','ice','salt','de-ic','plow','winter maint');
      },
      alternatives:['Multi-day storm event','Emergency plowing services','Salt and material costs'] },

    { id:'T1_EXTREME_COLD', tier:TIER1, category:'weather',
      label:'Extreme cold temperatures recorded — elevated heating costs and freeze risk',
      condition: ctx => {
        const w = sg(ctx.dataContext,'weather',ctx.monthLabel);
        return w && w.avgTemp != null && w.avgTemp < -5 && nm(ctx.metric,'heat','gas','fuel','hvac','util','energy','pipe','plumb');
      },
      alternatives:['Heating system at max capacity','Pipe freeze prevention','Emergency HVAC repairs'] },

    { id:'T1_EXTREME_HEAT', tier:TIER1, category:'weather',
      label:'Extreme heat recorded — HVAC cooling at peak capacity driving electricity costs',
      condition: ctx => {
        const w = sg(ctx.dataContext,'weather',ctx.monthLabel);
        return w && w.avgTemp != null && w.avgTemp > 30 && nm(ctx.metric,'electric','hvac','cool','util','energy','power');
      },
      alternatives:['AC units running continuously','Chiller system overtime','Peak demand surcharges'] },

    { id:'T1_HEAVY_RAIN', tier:TIER1, category:'weather',
      label:'Heavy precipitation recorded — water damage, drainage issues, or landscaping impact',
      condition: ctx => {
        const w = sg(ctx.dataContext,'weather',ctx.monthLabel);
        return w && w.totalPrecip > 200 && nm(ctx.metric,'repair','maint','landscap','drain','roof','water damage','flood');
      },
      alternatives:['Flood remediation','Drainage system repairs','Landscaping restoration'] },

    { id:'T1_FEMA_DISASTER', tier:TIER1, category:'disaster',
      label:'FEMA disaster declared in state during this period — operational disruption likely',
      condition: ctx => {
        const fema = sg(ctx.dataContext,'fema') || [];
        const d = ctx.monthLabel ? new Date(yr(ctx.monthLabel), MO_ABBR.indexOf(mo(ctx.monthLabel)), 1) : null;
        if (!d) return false;
        const qStart = new Date(d.getFullYear(), Math.floor(d.getMonth()/3)*3, 1);
        const qEnd = new Date(d.getFullYear(), Math.floor(d.getMonth()/3)*3+3, 0);
        return fema.some(f => { const fd = new Date(f.date+'T00:00:00'); return fd >= qStart && fd <= qEnd; });
      },
      alternatives:['Direct property damage','Tenant displacement','Insurance claim processing'] },

    { id:'T1_FED_RATE_HIKE', tier:TIER1, category:'macro',
      label:'Federal Reserve raised rates in this period — financing costs increased',
      condition: ctx => {
        const fed = sg(ctx.dataContext,'fred','fedfunds',ctx.monthLabel);
        const fedP = sg(ctx.dataContext,'fred','fedfunds',prevLabel(ctx.monthLabel));
        return fed != null && fedP != null && (fed-fedP) >= 0.25 && nm(ctx.metric,'interest','financ','debt','loan','mortgage');
      },
      alternatives:['Variable rate debt repricing','Refinancing at higher rate','Bridge loan cost increase'] },

    { id:'T1_FED_RATE_HIGH', tier:TIER1, category:'macro',
      label:'Federal funds rate elevated above 5% — significant drag on financing costs',
      condition: ctx => {
        const fed = sg(ctx.dataContext,'fred','fedfunds',ctx.monthLabel);
        return fed != null && fed > 5.0 && nm(ctx.metric,'interest','financ','debt','loan','mortgage') && ctx.anomaly.pnl==='loss';
      },
      alternatives:['Elevated debt service burden','Refinancing postponed','Cash flow squeeze from rates'] },

    { id:'T1_HIGH_CPI', tier:TIER1, category:'macro',
      label:'National inflation elevated (CPI >4% YoY) — driving operating cost increases',
      condition: ctx => {
        const cpi = sg(ctx.dataContext,'fred','cpi',ctx.monthLabel);
        const cpiYA = sg(ctx.dataContext,'fred','cpi',yoyLabel(ctx.monthLabel));
        const yoy = (cpi && cpiYA && cpiYA !== 0) ? ((cpi-cpiYA)/Math.abs(cpiYA))*100 : null;
        return yoy != null && yoy > 4 && ctx.metric.section==='EXPENSES' && ctx.anomaly.pnl==='loss';
      },
      alternatives:['Supply chain cost pass-through','Vendor inflation adjustments','Material cost escalation'] },

    { id:'T1_LOW_CPI_CONTRA', tier:TIER1, category:'macro',
      label:'Inflation low (<2% YoY) — expense spike NOT driven by macro inflation, likely asset-specific',
      condition: ctx => {
        const cpi = sg(ctx.dataContext,'fred','cpi',ctx.monthLabel);
        const cpiYA = sg(ctx.dataContext,'fred','cpi',yoyLabel(ctx.monthLabel));
        const yoy = (cpi && cpiYA && cpiYA !== 0) ? ((cpi-cpiYA)/Math.abs(cpiYA))*100 : null;
        return yoy != null && yoy < 2 && ctx.metric.section==='EXPENSES' && ctx.anomaly.pnl==='loss';
      },
      alternatives:['Asset-specific cost event','Vendor contract issue','One-time charge'] },

    { id:'T1_HIGH_UNEMPLOYMENT', tier:TIER1, category:'macro',
      label:'State unemployment elevated (>5.5%) — weak labor market suppressing rental demand',
      condition: ctx => {
        const ur = sg(ctx.dataContext,'fred','stateUR',ctx.monthLabel);
        return ur != null && ur > 5.5 && ctx.metric.section==='INCOME' && ctx.anomaly.pnl==='loss';
      },
      alternatives:['Tenant job losses','Market-wide demand reduction','Increased move-outs'] },

    { id:'T1_LOW_UNEMP_CONTRA', tier:TIER1, category:'macro',
      label:'Very low unemployment (<3.5%) contradicts demand weakness — issue is asset-specific',
      condition: ctx => {
        const ur = sg(ctx.dataContext,'fred','stateUR',ctx.monthLabel);
        return ur != null && ur < 3.5 && nm(ctx.metric,'vacancy','occupancy','vacant') && ctx.anomaly.pnl==='loss';
      },
      alternatives:['Property-specific issue','Competitive new supply','Management/marketing failure'] },

    { id:'T1_ELEC_PRICE_UP', tier:TIER1, category:'energy',
      label:'State electricity price increased >5% — driving utility expense higher',
      condition: ctx => {
        const ep = sg(ctx.dataContext,'eia','electricityPrice',ctx.monthLabel);
        const epP = sg(ctx.dataContext,'eia','electricityPrice',prevLabel(ctx.monthLabel));
        return ep && epP && ep > epP * 1.05 && nm(ctx.metric,'electric','power','energy','util');
      },
      alternatives:['Grid demand surcharge','Seasonal rate tier','Utility rate filing'] },

    { id:'T1_GAS_PRICE_UP', tier:TIER1, category:'energy',
      label:'State natural gas price increased >8% — driving heating/gas expense higher',
      condition: ctx => {
        const gp = sg(ctx.dataContext,'eia','gasPrice',ctx.monthLabel);
        const gpP = sg(ctx.dataContext,'eia','gasPrice',prevLabel(ctx.monthLabel));
        return gp && gpP && gp > gpP * 1.08 && nm(ctx.metric,'gas','fuel','heat','util');
      },
      alternatives:['Winter demand spike','Supply constraint','Rate adjustment'] },

    { id:'T1_BUILDING_PERMITS_UP', tier:TIER1, category:'macro',
      label:'Building permit activity up >15% YoY in state — new competing supply entering market',
      condition: ctx => {
        const permits = sg(ctx.dataContext,'buildingPermits') || {};
        const y = yr(ctx.monthLabel);
        return permits[String(y)] && permits[String(y-1)] && permits[String(y)] > permits[String(y-1)] * 1.15 && ctx.metric.section==='INCOME' && ctx.anomaly.pnl==='loss';
      },
      alternatives:['New apartment deliveries','Lease-up competition','Market oversupply'] },

    { id:'T1_CONSTRUCTION_COST_UP', tier:TIER1, category:'macro',
      label:'Construction/maintenance cost index rising — driving repair and capex costs higher',
      condition: ctx => {
        const ppi = sg(ctx.dataContext,'bls','constructionPPI',ctx.monthLabel);
        const ppiP = sg(ctx.dataContext,'bls','constructionPPI',prevLabel(ctx.monthLabel));
        return ppi && ppiP && ppi > ppiP * 1.02 && nm(ctx.metric,'repair','maint','capex','construct','renovat','turnover');
      },
      alternatives:['Material cost increases','Labor shortage premium','Supply chain delays'] },

    // ═════════════════════════════════════════════════════
    // TIER 2: METRIC-SPECIFIC (15 rules)
    // Strong — matches exact metric name + context
    // ═════════════════════════════════════════════════════

    { id:'T2_SNOW', tier:TIER2, category:'metric_specific',
      label:'Snow removal expense — seasonal contract activation or storm response',
      condition: ctx => nm(ctx.metric,'snow','ice','salt','de-ic','plow') && ctx.anomaly.pnl==='loss',
      alternatives:['Seasonal contract activation','Multi-day storm','Emergency plowing'] },

    { id:'T2_LANDSCAPING_SPRING', tier:TIER2, category:'metric_specific',
      label:'Landscaping spring activation — service resumption after winter',
      condition: ctx => nm(ctx.metric,'landscap','lawn','irrigation','tree') && (isSpring(mo(ctx.monthLabel)) || isSummer(mo(ctx.monthLabel))),
      alternatives:['Seasonal contract start','Property enhancement','Irrigation activation'] },

    { id:'T2_RE_TAX', tier:TIER2, category:'metric_specific',
      label:'Property tax reassessment or annual billing cycle',
      condition: ctx => nm(ctx.metric,'real estate tax','property tax','tax assess') && ctx.anomaly.pnl==='loss',
      alternatives:['Annual rate increase','Post-construction assessment','Tax appeal settlement'] },

    { id:'T2_INSURANCE', tier:TIER2, category:'metric_specific',
      label:'Insurance premium change — annual renewal or market hardening',
      condition: ctx => nm(ctx.metric,'insurance','premium','liability') && ctx.anomaly.pnl==='loss',
      alternatives:['Market-wide premium increase','Claims history surcharge','Coverage expansion'] },

    { id:'T2_BAD_DEBT', tier:TIER2, category:'metric_specific',
      label:'Bad debt write-off — uncollectible tenant receivables',
      condition: ctx => nm(ctx.metric,'bad debt','write.?off','uncollect','allowance'),
      alternatives:['Large tenant default','Accumulated arrears write-off','Policy change'] },

    { id:'T2_BAD_DEBT_DEC', tier:TIER2, category:'metric_specific',
      label:'December bad debt write-off — annual accounting cleanup',
      condition: ctx => nm(ctx.metric,'bad debt','write.?off') && /dec/i.test(mo(ctx.monthLabel)),
      alternatives:['Annual reserve adjustment','Audit-driven write-off','Collection review'] },

    { id:'T2_PAYROLL', tier:TIER2, category:'metric_specific',
      label:'Payroll anomaly — staffing change, overtime, or seasonal labor',
      condition: ctx => nm(ctx.metric,'payroll','salary','wage','staff','employee','labor','overtime'),
      alternatives:['New hire or termination','Overtime for emergency','Seasonal staffing'] },

    { id:'T2_PAYROLL_JAN', tier:TIER2, category:'metric_specific',
      label:'January payroll increase — annual salary adjustments and benefit resets',
      condition: ctx => nm(ctx.metric,'payroll','salary','wage') && /jan/i.test(mo(ctx.monthLabel)) && ctx.anomaly.pnl==='loss',
      alternatives:['Annual merit increases','Benefits enrollment','Payroll tax updates'] },

    { id:'T2_WATER', tier:TIER2, category:'metric_specific',
      label:'Water/sewer expense anomaly — seasonal usage, rate change, or leak',
      condition: ctx => nm(ctx.metric,'water','sewer','irrigation') && ctx.metric.section==='EXPENSES',
      alternatives:['Summer irrigation peak','Municipal rate increase','Plumbing leak'] },

    { id:'T2_ELECTRIC', tier:TIER2, category:'metric_specific',
      label:'Electricity expense anomaly — HVAC demand, rate change, or equipment issue',
      condition: ctx => nm(ctx.metric,'electric','power','energy') && ctx.metric.section==='EXPENSES',
      alternatives:['HVAC peak demand','Rate increase','Equipment malfunction'] },

    { id:'T2_GAS', tier:TIER2, category:'metric_specific',
      label:'Gas/heating expense anomaly — seasonal demand or rate change',
      condition: ctx => nm(ctx.metric,'gas','fuel','heat') && ctx.metric.section==='EXPENSES' && !nm(ctx.metric,'landscap'),
      alternatives:['Winter heating peak','Rate increase','Boiler issue'] },

    { id:'T2_MGMT_FEE', tier:TIER2, category:'metric_specific',
      label:'Management fee change — revenue-linked fee fluctuation or contract change',
      condition: ctx => nm(ctx.metric,'management fee','mgmt fee','property manage'),
      alternatives:['Revenue change driving % fee','Fee renegotiation','New management company'] },

    { id:'T2_CONCESSION', tier:TIER2, category:'metric_specific',
      label:'Concession spike — competitive leasing incentive or retention effort',
      condition: ctx => nm(ctx.metric,'concession','free rent','incentive','discount'),
      alternatives:['Competitive market incentives','Lease-up offering','Seasonal retention'] },

    { id:'T2_VACANCY', tier:TIER2, category:'metric_specific',
      label:'Vacancy change — occupancy shift from tenant movement or market conditions',
      condition: ctx => nm(ctx.metric,'vacancy','occupancy','vacant','void'),
      alternatives:['Multi-unit departure','Market softening','Renovation vacancy'] },

    { id:'T2_CLEANING', tier:TIER2, category:'metric_specific',
      label:'Cleaning cost spike — unit turnover, contract change, or seasonal deep-clean',
      condition: ctx => nm(ctx.metric,'clean','janitor','turnover.*clean'),
      alternatives:['High turnover month','Contract rate increase','Deep cleaning program'] },

    // ═════════════════════════════════════════════════════
    // TIER 3: DATA PATTERN (8 rules)
    // Medium — based on cross-metric or sequential patterns
    // ═════════════════════════════════════════════════════

    { id:'T3_CONSECUTIVE', tier:TIER3, category:'pattern',
      label:'Consecutive anomaly in same metric — ongoing trend, not one-off event',
      condition: ctx => (ctx.metric.anomalies||[]).includes(ctx.monthIdx - 1),
      alternatives:['Structural shift','Delayed response to earlier event','Management action pending'] },

    { id:'T3_MULTI_EXPENSE', tier:TIER3, category:'pattern',
      label:'Multiple expense anomalies in same month — systemic event across property',
      condition: ctx => {
        if (ctx.metric.section !== 'EXPENSES') return false;
        return (ctx.allMetrics||[]).filter(m => m.section==='EXPENSES' && m !== ctx.metric && (m.anomalies||[]).includes(ctx.monthIdx)).length >= 2;
      },
      alternatives:['Property-wide maintenance event','Vendor billing alignment','Insurance-related costs'] },

    { id:'T3_INCOME_VACANCY_LINK', tier:TIER3, category:'pattern',
      label:'Income decline + vacancy increase in same month — tenant departure event',
      condition: ctx => {
        if (ctx.metric.section !== 'INCOME' || ctx.anomaly.pnl !== 'loss') return false;
        return (ctx.allMetrics||[]).some(m => /vacancy|occupancy|vacant/i.test(m.name||'') && (m.anomalies||[]).includes(ctx.monthIdx));
      },
      alternatives:['Major tenant move-out','Multiple unit turnovers','Lease expiration cluster'] },

    { id:'T3_EXPENSE_DOWN', tier:TIER3, category:'pattern',
      label:'Expense reduction — cost management success, renegotiated contract, or efficiency gain',
      condition: ctx => ctx.metric.section === 'EXPENSES' && ctx.anomaly.pnl === 'profit',
      alternatives:['Contract renegotiation','Efficiency improvement','Seasonal reduction'] },

    { id:'T3_OPENING_PHASE', tier:TIER3, category:'pattern',
      label:'Property in opening/lease-up phase — elevated costs and volatile income expected',
      condition: ctx => {
        const oi = ctx.metric.openingIdx;
        return oi >= 0 && ctx.monthIdx >= oi && ctx.monthIdx <= oi + 5;
      },
      alternatives:['Lease-up marketing costs','Initial occupancy volatility','System commissioning'] },

    { id:'T3_MULTI_INCOME_DOWN', tier:TIER3, category:'pattern',
      label:'Multiple income metrics declining in same month — broad occupancy or pricing event',
      condition: ctx => {
        if (ctx.metric.section !== 'INCOME' || ctx.anomaly.pnl !== 'loss') return false;
        return (ctx.allMetrics||[]).filter(m => m.section==='INCOME' && m !== ctx.metric && (m.anomalies||[]).includes(ctx.monthIdx) && m.zScores?.[ctx.monthIdx]?.pnl==='loss').length >= 2;
      },
      alternatives:['Portfolio-wide repricing','Market downturn','Seasonal demand drop'] },

    { id:'T3_REIMBURSEMENT_SPIKE', tier:TIER3, category:'pattern',
      label:'Reimbursement income spike — catch-up billing or new cost recovery program',
      condition: ctx => nm(ctx.metric,'reimburs','reimb','recovery','charge.?back') && ctx.anomaly.pnl==='profit',
      alternatives:['Catch-up billing for prior months','New billing program launch','Rate adjustment'] },

    { id:'T3_OPENING_COST', tier:TIER3, category:'pattern',
      label:'Early-month expense at property opening — commissioning, setup, and launch costs',
      condition: ctx => {
        const oi = ctx.metric.openingIdx;
        return oi >= 0 && ctx.monthIdx <= oi + 2 && ctx.metric.section==='EXPENSES' && ctx.anomaly.pnl==='loss';
      },
      alternatives:['System commissioning','Pre-opening marketing','Staff onboarding'] },

    // ═════════════════════════════════════════════════════
    // TIER 4: GENERIC (20 rules)
    // Weakest — based on season, section, asset type, location
    // ═════════════════════════════════════════════════════

    // Asset type
    { id:'T4_OFFICE_SHORT', tier:TIER4, category:'asset_type',
      label:'Office income shortfall — hybrid work sensitivity or tenant downsizing',
      condition: ctx => /office/i.test(ctx.assetInfo.type||'') && ctx.metric.section==='INCOME' && ctx.anomaly.pnl==='loss',
      alternatives:['Rent-free incentive','Tenant CVA','Lease restructure'] },

    { id:'T4_RETAIL_SHORT', tier:TIER4, category:'asset_type',
      label:'Retail income shortfall — e-commerce pressure or anchor departure',
      condition: ctx => /retail|shopping|mall/i.test(ctx.assetInfo.type||'') && ctx.metric.section==='INCOME' && ctx.anomaly.pnl==='loss',
      alternatives:['Tenant CVA','Competing scheme','Anchor non-renewal'] },

    { id:'T4_INDUSTRIAL_UP', tier:TIER4, category:'asset_type',
      label:'Industrial income surplus — logistics demand premium',
      condition: ctx => /industrial|logistics|warehouse/i.test(ctx.assetInfo.type||'') && ctx.metric.section==='INCOME' && ctx.anomaly.pnl==='profit',
      alternatives:['Port proximity premium','Above-market lease-up','Rent review uplift'] },

    { id:'T4_RESI_SHORT', tier:TIER4, category:'asset_type',
      label:'Residential income shortfall — vacancy event or rent arrears',
      condition: ctx => /residential|multifamily|apartment/i.test(ctx.assetInfo.type||'') && ctx.metric.section==='INCOME' && ctx.anomaly.pnl==='loss',
      alternatives:['Refurbishment void','Rent arrears','Academic vacancy'] },

    { id:'T4_LAND_INCOME', tier:TIER4, category:'asset_type',
      label:'Land/development income — possible data classification error',
      condition: ctx => /land|development/i.test(ctx.assetInfo.type||'') && ctx.metric.section==='INCOME',
      alternatives:['Temporary license fee','Overage payment','Pre-dev rental'] },

    // Location
    { id:'T4_CBD', tier:TIER4, category:'location',
      label:'City-centre market cycle amplification',
      condition: ctx => /center|centre|cbd|downtown|midtown/i.test(ctx.assetInfo.location||'') && ctx.metric.section==='INCOME',
      alternatives:['New supply competition','Infrastructure disruption','Anchor departure'] },

    { id:'T4_TOURIST', tier:TIER4, category:'location',
      label:'Tourist area seasonal deviation',
      condition: ctx => /beach|marina|resort|seafront/i.test(ctx.assetInfo.location||'') && ctx.metric.section==='INCOME',
      alternatives:['Tourism suppression event','Platform delisting','Currency impact'] },

    { id:'T4_NEW_DEV', tier:TIER4, category:'location',
      label:'New development area absorption risk',
      condition: ctx => /new|regeneration|pinui|tama|masterplan/i.test(ctx.assetInfo.location||'') && ctx.metric.section==='INCOME' && ctx.anomaly.pnl==='loss',
      alternatives:['Target demographic lagging','Competing builds','Delayed infrastructure'] },

    // Political/Regulatory
    { id:'T4_RENT_CONTROL', tier:TIER4, category:'political',
      label:'Rent control ceiling in regulated market',
      condition: ctx => /berlin|amsterdam|paris|new york|nyc|san francisco|sf|stockholm|vienna/i.test(ctx.assetInfo.location||'') && ctx.metric.section==='INCOME' && ctx.anomaly.pnl==='loss',
      alternatives:['Voluntary freeze','Legal challenge','Low turnover under regulation'] },

    { id:'T4_TAX_REG', tier:TIER4, category:'political',
      label:'Regulatory cost — new tax, compliance charge, or assessment',
      condition: ctx => nm(ctx.metric,'tax','insurance','compliance','permit','license','assess') && ctx.metric.section==='EXPENSES' && ctx.anomaly.pnl==='loss',
      alternatives:['Rates revaluation','EPC upgrade','Fire safety enforcement'] },

    { id:'T4_LEGISLATION', tier:TIER4, category:'political',
      label:'Active housing legislation may be impacting operations',
      condition: ctx => {
        const bills = ((ctx.dataContext?.openStates||[]).length + (ctx.dataContext?.congress||[]).length);
        return bills > 0 && ctx.metric.section==='EXPENSES' && ctx.anomaly.pnl==='loss';
      },
      alternatives:['Tenant protection law','Environmental compliance','Building code update'] },

    // Operational
    { id:'T4_EMERGENCY_CAPEX', tier:TIER4, category:'operational',
      label:'Emergency capital expenditure — no prior anomaly pattern in this metric',
      condition: ctx => {
        const prior = (ctx.metric.anomalies||[]).filter(i => i < ctx.monthIdx);
        return ctx.metric.section==='EXPENSES' && ctx.anomaly.pnl==='loss' && prior.length===0;
      },
      alternatives:['Flood/fire remediation','Equipment replacement','Emergency repair'] },

    { id:'T4_VENDOR_ESCALATION', tier:TIER4, category:'operational',
      label:'Vendor contract escalation — prior anomaly pattern suggests ongoing cost pressure',
      condition: ctx => {
        const prior = (ctx.metric.anomalies||[]).filter(i => i < ctx.monthIdx);
        return ctx.metric.section==='EXPENSES' && ctx.anomaly.pnl==='loss' && prior.length > 0;
      },
      alternatives:['FM contract renewal','Reactive maintenance spiral','Inflation pass-through'] },

    { id:'T4_INCOME_UP', tier:TIER4, category:'operational',
      label:'Income increase — lease event, rent review, or new tenant',
      condition: ctx => ctx.metric.section==='INCOME' && ctx.anomaly.pnl==='profit',
      alternatives:['Rent review uplift','New tenant at market rate','Lease restructure'] },

    { id:'T4_INCOME_DOWN', tier:TIER4, category:'operational',
      label:'Income decrease — tenant departure, lease expiry, or rent reduction',
      condition: ctx => ctx.metric.section==='INCOME' && ctx.anomaly.pnl==='loss',
      alternatives:['Break clause exercised','Non-renewal','Concession granted'] },

    // Seasonality
    { id:'T4_WINTER_EXP', tier:TIER4, category:'seasonality',
      label:'Winter operational costs — heating, snow, cold-weather maintenance',
      condition: ctx => isWinter(mo(ctx.monthLabel)) && ctx.metric.section==='EXPENSES' && ctx.anomaly.pnl==='loss',
      alternatives:['Snow/ice management','Heating peak','Frozen pipe repairs'] },

    { id:'T4_SUMMER_EXP', tier:TIER4, category:'seasonality',
      label:'Summer operational costs — cooling, HVAC, landscaping, renovations',
      condition: ctx => isSummer(mo(ctx.monthLabel)) && ctx.metric.section==='EXPENSES' && ctx.anomaly.pnl==='loss',
      alternatives:['HVAC cooling peak','Summer renovation','Pool/amenity maintenance'] },

    { id:'T4_SUMMER_INCOME_UP', tier:TIER4, category:'seasonality',
      label:'Peak leasing season — summer move-in surge',
      condition: ctx => isSummer(mo(ctx.monthLabel)) && /residential|multifamily|apartment/i.test(ctx.assetInfo.type||'') && ctx.metric.section==='INCOME' && ctx.anomaly.pnl==='profit',
      alternatives:['University area demand','Seasonal premium','Corporate relocation'] },

    { id:'T4_WINTER_INCOME_DOWN', tier:TIER4, category:'seasonality',
      label:'Winter leasing slowdown — reduced demand and seasonal vacancy',
      condition: ctx => isWinter(mo(ctx.monthLabel)) && /residential|multifamily|apartment/i.test(ctx.assetInfo.type||'') && ctx.metric.section==='INCOME' && ctx.anomaly.pnl==='loss',
      alternatives:['Holiday move-out','Academic break','Reduced showings'] },

    { id:'T4_Q4_EXP', tier:TIER4, category:'seasonality',
      label:'Year-end provisioning — tax accruals, deferred maintenance, insurance renewal',
      condition: ctx => isQ4(mo(ctx.monthLabel)) && ctx.metric.section==='EXPENSES' && ctx.anomaly.pnl==='loss',
      alternatives:['Insurance renewal','Q4 maintenance catch-up','Year-end provisions'] },
  ];

  // ── JACCARD SIMILARITY ────────────────────────────────

  function jaccard(setA, setB) {
    const a = new Set(setA), b = new Set(setB);
    const inter = [...a].filter(x => b.has(x)).length;
    const union = new Set([...a, ...b]).size;
    return union === 0 ? 0 : inter / union;
  }

  // ── SCORE RULES — TIER-BASED RANKING ──────────────────

  function scoreRules(ctx) {
    const fired = [];
    RULES.forEach(rule => {
      try { if (rule.condition(ctx)) fired.push({ ...rule }); } catch (_) {}
    });
    // Sort by tier (ascending = strongest first), then alphabetical within tier
    return fired.sort((a, b) => a.tier - b.tier || a.id.localeCompare(b.id));
  }

  // ── CLUSTER ANOMALIES ─────────────────────────────────

  function clusterAnomalies(allResults) {
    const clusters = [];
    allResults.forEach(a => {
      let assigned = false;
      for (const cluster of clusters) {
        const rep = cluster.members[0];
        const sim = jaccard(a.firedRuleIds, rep.firedRuleIds);
        const dirMatch = Math.sign(a.effectiveZ) === Math.sign(rep.effectiveZ);
        const score = sim * (dirMatch ? 1 : 0.7);
        if (score >= 0.5) { cluster.members.push(a); if (score >= 0.65) cluster.core.push(a); assigned = true; break; }
      }
      if (!assigned) clusters.push({ members: [a], core: [a] });
    });
    clusters.forEach(c => {
      const freq = {};
      c.core.forEach(m => m.firedRuleIds.forEach(id => { freq[id] = (freq[id]||0)+1; }));
      const topRule = Object.entries(freq).sort((a,b) => b[1]-a[1])[0]?.[0] || '';
      const rule = RULES.find(r => r.id === topRule);
      const dirLabel = c.core[0]?.pnl === 'profit' ? 'Surplus' : 'Shortfall/Overspend';
      c.label = rule ? `${rule.category.replace(/_/g,' ')} — ${dirLabel}` : 'Unclassified Cluster';
    });
    return clusters;
  }

  // ── CORROBORATING ─────────────────────────────────────

  function findCorroborating(target, allResults) {
    return allResults.filter(r => r !== target).map(r => {
      const sim = jaccard(target.firedRuleIds, r.firedRuleIds);
      const dirMatch = Math.sign(target.effectiveZ) === Math.sign(r.effectiveZ);
      return { ...r, similarity: Math.round(sim * (dirMatch ? 1 : 0.7) * 100) };
    }).filter(r => r.similarity >= 50).sort((a,b) => b.similarity - a.similarity).slice(0,5);
  }

  // ── MAIN ENTRY ────────────────────────────────────────

  function analyse(metrics, months, assetInfo, dataContext) {
    const allResults = [];

    metrics.forEach(metric => {
      (metric.anomalies || []).forEach(relIdx => {
        const absMonthIdx = metric.displayMonths ? metric.displayMonths[relIdx] : relIdx;
        const monthLabel = months[absMonthIdx] || '';
        const z = metric.zScores[relIdx];
        if (!z) return;

        const ctx = {
          anomaly: { ...z, pnl: z.pnl },
          metric, allMetrics: metrics, assetInfo, dataContext,
          monthIdx: relIdx, monthLabel,
        };

        const fired = scoreRules(ctx);
        const firedRuleIds = fired.map(r => r.id);

        const primary = fired[0] || {
          label:'Unclassified anomaly — insufficient context', tier:TIER4,
          alternatives:['Data entry error','One-off event','Budget reclassification'],
        };

        const alternatives = fired.length > 1
          ? fired.slice(1,4).map(r => r.label)
          : primary.alternatives.slice(0,3);
        while (alternatives.length < 3) alternatives.push('Insufficient data for additional hypothesis');

        const result = {
          metricId: metric.id, metricName: metric.name, section: metric.section,
          monthIdx: relIdx, absMonthIdx, monthLabel, firedRuleIds,
          effectiveZ: z.effectiveZ, pnl: z.pnl,
          primary, alternatives,
          topTier: fired.length ? fired[0].tier : TIER4,
          firedByTier: {
            tier1: fired.filter(r => r.tier===TIER1).map(r => r.label),
            tier2: fired.filter(r => r.tier===TIER2).map(r => r.label),
            tier3: fired.filter(r => r.tier===TIER3).map(r => r.label),
            tier4: fired.filter(r => r.tier===TIER4).map(r => r.label),
          },
        };

        allResults.push(result);
        if (!metric.reasonData) metric.reasonData = {};
        metric.reasonData[relIdx] = result;
      });
    });

    const clusters = clusterAnomalies(allResults);
    allResults.forEach(r => { r.corroborating = findCorroborating(r, allResults); });

    return { results: allResults, clusters };
  }

  return { analyse, RULES, jaccard, TIER1, TIER2, TIER3, TIER4 };
})();
