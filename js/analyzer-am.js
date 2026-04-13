// ══════════════════════════════════════════════════════════════
// SECTION: AM Analyzer UI Module
// ══════════════════════════════════════════════════════════════

const CATEGORY_MAP = {
  'RENTAL INCOME': ['Market Rent','(Loss)/Gain to Lease','Less: Vacancy','Residential Rent','Concession','Military Discount Concession','Preferred Employer Concession','First Responder Concession','Employee Concession','Courtesy Patrol','Rent Adjustment','Preferential Rent','Section 8','Down Units','Admin Units','Model Unit','Month to Month','Seller Arrears','Delinquency'],
  'COST RECOVERY': ['Reimbursed Water/Sewer','Reimbursed Trash','Reimbursed Utilities','Reimbursed Renters Insurance','Reimbursed Utility Fee','Reimbursed Deposit Alternatives','Rev Share','Other Reimbursed costs'],
  'OTHER INCOME': ['Condo Assoc Fee','Estoppel Fee','Marketing Service Agreement','Amenity Fee','Charging Station Income','Legal Fees','Pet Rent','Key Charge','Pet Fee','Pest Control','Laundry','Interest income','Interest Expense','Cable','Parking Income','Transfer Apartment','Late Fees','Bike','Administrative Fee','Cleaning Fee','Furnished Unit Expenses','Lockout Fee','Inspection Fee','Smoking Fee','Damages Fee','Application Fee','Early Termination Fee','Bounced Check Fee','Court Cost','Miscellaneous','Licensing fees','Unallocated Payments','Storage Income'],
  'COMMERCIAL INCOME': ['COMMERCIAL RENT','CAM Income','Antenna Income'],
  'AUTO EXPENSE': ['Vehicle Registration','Auto Leasing','EZ Pass','Gas','Auto Insurance','Parking','Parking Fine','Auto Repairs','Tolls'],
  'GENERAL AND ADMINISTRATIVE': ['Ramp Plus Charges','Bank Service Charges','Clickpay','Yardi expense','Yardi Payment Processing Fees','Deposit Alternative','Renters Insurance','Wire Transfer Fee','Tenant Screening','Travel Expense','Temp Housing','BlueMoon','Tech Costs','Shipping (UPS FEDEX)','Postage','Printing Expense','Escrow Admin Fee','Alert Services/ Security Alarm','Messaging/ Answering Service','Phones/Internet/Cable','Employee Gifts','Food & Entertaiment','Water/ Coffee/ Drinks for Office','Staff Retention & Entertainment','Staff Merchandise','Software Subscriptions','Holiday Party','Seasonal Decorations','Recruiting Expense','Contributions','Affordable Housing Management & Compliance','Legal L & T','Broker of Record (L&T)','Security','Consulting Fees','Corporation Tax','Professional Fees','Union Dues','Office Furniture','Office Supplies','Office Equipment','Financing fee','Office Expense','Training/ Seminars','Uniforms','Property Registration','Fees and Permits','Memberships','Website & Domain Services','Licenses','Miscellaneous Expense','Online Payment Fee'],
  'MANAGEMENT FEES': ['Management Fees'],
  'LEASING & MARKETING': ['Online Marketing Expense','Print Marketing','Marketing Concessions','Resident Pet Program','Marketing Software','Resident Events','Resident Retention','Resident Coffee Station','Other Marketing Expense','Promotion and entertainment','Community Functions','Signage Marketing','Resident Referral','Brokers fee'],
  'ADMIN PAYROLL': ['Payroll - Admin Assistant Property Manager','Assistant Manager','Payroll Taxes - Administrative','Workers Comp - Administrative','Health Insurance - Administrative','Overtime - Administrative','Bonus - Administrative'],
  'LEASING PAYROLL': ['Payroll - Leasing','Leasing Consultant','Payroll Taxes - Leasing','Workers Comp - Leasing','Health Insurance - Leasing','Overtime - Leasing','Bonus - Leasing'],
  'MAINTENANCE PAYROLL': ['Payroll - Maintenance','Maintenance Tech','Payroll Taxes - Maintenance','Workers Comp - Maintenance','Health Insurance - Maintenance','Overtime - Maintenance','Bonus - Maintenance'],
  'PROPERTY MANAGER PAYROLL': ['Payroll - Property Manager'],
  'OTHER PAYROLL': ['Reimbursement - Phones/Gas/Tolls','Payroll Services','Outside Services','Severance Pay'],
  'TAXES AND INSURANCE': ['Property & Liability Insurance','Umbrella Insurance','Flood Insurance','ELPI Insurance','Real Estate Taxes','Consultant'],
  'UTILITIES': ['Electric Expense','Electric Expense - vacant units','Gas Expense','Gas Expense - Vacant Units','Water expense','Sewer Expense','Rubbish Removal/Sanitation','Utility Billing','Recoverable Elec/Gas/Water'],
  'UNIT TURNOVER': ['Unit Turnover - Carpet Cleaning & Repairs','Paint & Plaster Contract','Paint & Plaster Contract - Extra service','Unit Turnover - Painting','Unit Turnover - Cleaning','Unit Turnover - Countertop Repairs','Unit Turnover - Vinyl Repairs','Unit Turnover - Appliances','Unit Turnover - HVAC Repairs','Unit Turnover - Bathroom Repairs','Unit Turnover - Inspection Fees','Unit Turnover - Resurfacing','Unit Turnover - Floor Repairs','Unit Turnover - General Repairs','Unit Turnover - Kitchen Repairs','Unit Turnover - Supplies'],
  'CONTRACT REPAIRS': ['Amazon Locker Lease','Intercom Software Contract','Software Contract','EV Station Software Contract','Exterminating Contract','Exterminating Contract - Extra service','Pool Maintenance Contract','Pool Maintenance Contract - Extra service','Power Washing','Landscaping Contract','Landscaping Contract - Extra service','Concierge Services Contract','Cleaning Contract','Valet Trash','Sprinkler contract','Scent Services Contract','Gym Fees','Peloton Contract','Vent Cleaning','HVAC Contract','Aquarium Servicing Contract','Generator Inspection Contract','Cleaning Contract - Extra service','Shuttle Contract','Flooring & Carpeting Contract','Snow Removal Contract','Snow Removal Contract - Extra service','Pond Treatment Contract','Storage Unit Contract','Washer & Dryer Rental Contract','Fire/Sprinkler Inspections & Monitoring Contract','Fire Alarm Monitoring Contract','Elevator Contract','Security - Live Monitoring Contract'],
  'REPAIRS & MAINTENANCE': ['Elevator Consultant','Plumber - In House','Fire Pump Fuel','Boiler Repairs & Maint','Hot water Heaters','Fitness center repairs/contract','Flooring & Carpeting','Parking Pass','PTAC Repair Parts','Signs and Safety','Welding','Fireplace/Chimney Repairs','Package Locker Service','Fencing','Lead Abatement & Testing','Paint & Plaster','Plumbing Repairs & Maint','Exterior Repairs & Maint','Hallway Cleaning','Interior Repairs & Maint','Elevator Repairs & Maint','Gutter Repairs & Maint','Bathroom Repairs & Maint','Amenities Supplies/Equipment','Amenity Repairs & Maint','Roof Repairs & Maint','Carpet Cleaning','Compactor','Generator Expenses','Landscape Repairs','One time Cleanup','Doors/Garage','Mold','Sewer and Drain Cleaning','Leak Repair','Fire Extinguisher','HVAC Repairs & Maint','HVAC Cleaning','Intercom','Electrical Repairs & Maint','Towing costs','Carpet Repairs & Maint','Golf Cart Repairs & Maint','Security camera','Kitchen supplies','Bathroom Supplies','Plumbing supplies','Paint Supplies','Landscaping Supplies','Tiles','Hardware Supplies','Pool Supplies','Outdoor Sports/Activities/Equipment','Janitorial Supplies','Ground Supplies','Building & Maintenance Supplies','Electrical Supplies','Miscellaneous Supplies','First Aid & Safety Supplies','Appliances','Appliance Parts','Tools','Hvac Parts','Covid19 Expenses','Filters','Elevator Inspections and Permits','Inspections and Permits','Sprinklers','Pool Repairs/Maintenance','Windows/Screens','Window Shades','Locks & Keys','Fire Alarms','Smoke Alarms','Paving','Screen','Environmental Compliance','PO Suspense Expense','Locksmith'],
  'OTHER EXPENSES': ['Parking Lot Lease','Property Inspection','Late Fee','Bad debts expense','Bad Debt Recoveries','Violation Penalty','Violation Removal'],
};

const INCOME_CATEGORIES = new Set(['RENTAL INCOME','COST RECOVERY','OTHER INCOME','COMMERCIAL INCOME']);

// ── groupByCategory ───────────────────────────────────────────
// Maps analyzeAsset() results into per-category monthly totals.
// Returns an array of { categoryName, section, monthTotals[] }
// sorted income categories first, then expense.
function groupByCategory(results) {
  // Build reverse lookup: metric name → category name
  const metricToCategory = new Map();
  for (const [cat, metrics] of Object.entries(CATEGORY_MAP)) {
    for (const m of metrics) metricToCategory.set(m, cat);
  }

  // Accumulate totals per category
  const catMap = new Map(); // categoryName → { categoryName, section, monthTotals[] }

  for (const result of results) {
    if (!result) continue;
    const cat = metricToCategory.get(result.name);
    if (!cat) continue; // metric not in CATEGORY_MAP — skip

    if (!catMap.has(cat)) {
      catMap.set(cat, {
        categoryName: cat,
        section: INCOME_CATEGORIES.has(cat) ? 'income' : 'expense',
        monthTotals: [],
      });
    }

    const entry = catMap.get(cat);

    for (let i = 0; i < result.res.length; i++) {
      const v = result.res[i]?.v;
      if (v == null) continue;
      if (entry.monthTotals[i] == null) entry.monthTotals[i] = 0;
      entry.monthTotals[i] += v;
    }
  }

  // Return as sorted array: income categories first, then expense
  return Array.from(catMap.values()).sort((a, b) => {
    if (a.section !== b.section) return a.section === 'income' ? -1 : 1;
    return a.categoryName.localeCompare(b.categoryName);
  });
}

// ── module-level reverse lookup (built once) ──────────────────
const _metricToCategory = (function() {
  const m = new Map();
  for (const [cat, metrics] of Object.entries(CATEGORY_MAP))
    for (const name of metrics) m.set(name, cat);
  return m;
})();

// ── private helpers ───────────────────────────────────────────

function _fmtAmt(v) {
  if (v == null) return '\u2014';
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1000000) return sign + '$' + (abs / 1000000).toFixed(1) + 'M';
  if (abs >= 1000)    return sign + '$' + (abs / 1000).toFixed(1) + 'k';
  return sign + '$' + abs.toFixed(0);
}

function _borderColor(flag) {
  if (flag.conflicting) return 'var(--orange)';
  if (flag.at === 'pos') return 'var(--green)';
  if (flag.at === 'neg') return 'var(--red)';
  return 'var(--orange)'; // mixed (category view)
}

function _movementColor(flag) {
  if (flag.at === 'pos') return 'var(--green)';
  if (flag.at === 'neg') return 'var(--red)';
  return 'var(--orange)';
}

function _triggerLabel(flag) {
  const p = flag.flaggedByPrior, t = flag.flaggedByT12, c = flag.conflicting;
  if (p && t && c) return 'T3 + T12 \u00b7 conflicting';
  if (p && t)      return 'T3 + T12';
  if (t)           return 'T12 drift';
  return 'T3 momentum';
}

// Build a flag object for one metric result.
// Returns null if the result has no material anomaly cells.
function _metricFlag(result, months) {
  let worstIdx = -1, worstMovement = 0;
  for (const r of result.res) {
    if (r.st !== 'anom') continue;
    const movement = r.zm === 't3' ? Math.abs(r.chv || 0) : Math.abs(r.v || 0) * 12;
    if (movement > worstMovement) { worstMovement = movement; worstIdx = r.mi; }
  }
  if (worstIdx < 0) return null;

  const r   = result.res[worstIdx];
  const n   = worstIdx;
  const vals = result.res.map(rx => rx.v || 0);
  const T3_current = n >= 2 ? (vals[n] + vals[n-1] + vals[n-2]) * 4 : (r.v || 0) * 12;
  const T3_prior   = n >= 3 ? (vals[n-1] + vals[n-2] + vals[n-3]) * 4 : null;
  const cat = _metricToCategory.get(result.name) || (result.isInc ? 'OTHER INCOME' : 'OTHER EXPENSES');

  return {
    name:           result.name,
    section:        cat,
    isInc:          result.isInc,
    worstIdx:       n,
    worstFlagMonth: months[n] || String(n),
    worstMonthLabel:months[n] || String(n),
    movement:       worstMovement,
    at:             r.at,
    flaggedByPrior: r.flaggedByPrior || false,
    flaggedByT12:   r.flaggedByT12   || false,
    conflicting:    r.conflicting    || false,
    T12:            r.T12,
    T3_current,
    T3_prior,
    zm:             r.zm,
    result,
  };
}

function _buildMetricFlags(results, months) {
  const flags = [];
  for (const result of results) {
    if (!result) continue;
    const f = _metricFlag(result, months);
    if (f) flags.push(f);
  }
  return flags.sort((a, b) => b.movement - a.movement);
}

function _buildCategoryFlags(results, months) {
  const metricFlags = _buildMetricFlags(results, months);
  const catMap = new Map();
  for (const f of metricFlags) {
    if (!catMap.has(f.section)) catMap.set(f.section, []);
    catMap.get(f.section).push(f);
  }
  const catFlags = [];
  for (const [cat, flags] of catMap) {
    const worst = flags.reduce((a, b) => a.movement > b.movement ? a : b);
    const totalMovement = flags.reduce((s, f) => s + f.movement, 0);
    const posCount = flags.filter(f => f.at === 'pos').length;
    const negCount = flags.filter(f => f.at === 'neg').length;
    const at = posCount > negCount ? 'pos' : negCount > posCount ? 'neg' : 'mixed';
    catFlags.push({
      name:           cat,
      section:        cat,
      isInc:          INCOME_CATEGORIES.has(cat),
      worstIdx:       worst.worstIdx,
      worstFlagMonth: worst.worstFlagMonth,
      worstMonthLabel:worst.worstMonthLabel,
      movement:       totalMovement,
      at,
      conflicting:    flags.some(f => f.conflicting),
      flaggedByPrior: worst.flaggedByPrior,
      flaggedByT12:   worst.flaggedByT12,
      T12:            worst.T12,
      T3_current:     worst.T3_current,
      T3_prior:       worst.T3_prior,
      zm:             worst.zm,
      result:         worst.result,
      flags,          // constituent metric flags
      isCategoryFlag: true,
    });
  }
  return catFlags.sort((a, b) => b.movement - a.movement);
}

// Build the metricBreakdown array used by fetchAMReasoning + renderAMDetailPanel.
function _metricBreakdownForFlag(flag) {
  if (flag.isCategoryFlag) {
    return flag.flags.map(f => ({
      name:      f.name,
      T3current: f.T3_current,
      T3prior:   f.T3_prior,
      T12:       f.T12,
      at:        f.at,
    }));
  }
  return [{
    name:      flag.name,
    T3current: flag.T3_current,
    T3prior:   flag.T3_prior,
    T12:       flag.T12,
    at:        flag.at,
  }];
}

// ── renderAMAnalyzer ──────────────────────────────────────────

function renderAMAnalyzer(results, months, purchasePrice, containerId) {
  containerId = containerId || 'assetMgmtMode';
  const container = document.getElementById(containerId);
  if (!container) return;

  if (window._amViewMode === undefined) window._amViewMode = 'metric';
  if (window._amLimit    === undefined) window._amLimit    = 25;

  const allFlags = window._amViewMode === 'category'
    ? _buildCategoryFlags(results, months)
    : _buildMetricFlags(results, months);

  if (!allFlags.length) {
    container.innerHTML = '<div style="font-family:var(--font-display);font-size:12px;color:var(--text-muted);padding:48px;text-align:center;">No material anomalies detected.</div>';
    return;
  }

  const displayed = allFlags.slice(0, window._amLimit);

  // ── toolbar ───────────────────────────────────────────────
  function activeToggleStyle(active) {
    return active
      ? 'background:var(--accent);border:1px solid var(--accent);color:var(--bg-base);'
      : 'background:var(--bg-elevated);border:1px solid var(--border);color:var(--text-muted);';
  }
  function activeLimitStyle(active) {
    return active
      ? 'background:var(--accent);border:1px solid var(--accent);color:var(--bg-base);'
      : 'background:var(--bg-elevated);border:1px solid var(--border);color:var(--text-muted);';
  }

  const baseBtn = 'font-family:var(--font-display);font-size:10px;padding:5px 11px;border-radius:var(--radius);cursor:pointer;letter-spacing:0.3px;transition:opacity 0.15s;';

  let html = '<div style="display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:18px;">';

  // View-mode toggle
  html += `<div style="display:flex;gap:4px;">
    <button class="am-view-toggle" data-view="metric"   style="${baseBtn}${activeToggleStyle(window._amViewMode==='metric')}">&#x1F4CA; View by Metric</button>
    <button class="am-view-toggle" data-view="category" style="${baseBtn}${activeToggleStyle(window._amViewMode==='category')}">&#x1F5C2; View by Category</button>
  </div>`;

  // Limit filter
  html += '<div style="display:flex;align-items:center;gap:4px;margin-left:auto;">';
  html += '<span style="font-family:var(--font-display);font-size:9px;color:var(--text-muted);letter-spacing:0.5px;">SHOW</span>';
  for (const lim of [10, 25, 50, 100]) {
    html += `<button class="am-limit-btn" data-limit="${lim}" style="${baseBtn}${activeLimitStyle(window._amLimit===lim)}">${lim}</button>`;
  }
  html += '</div></div>'; // end toolbar

  // Stats line
  html += `<div style="font-family:var(--font-display);font-size:9px;color:var(--text-muted);margin-bottom:16px;letter-spacing:0.4px;">${allFlags.length} flagged &middot; showing top ${displayed.length}</div>`;

  // ── cards grid ────────────────────────────────────────────
  html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;">';

  displayed.forEach((flag, idx) => {
    const bc    = _borderColor(flag);
    const mc    = _movementColor(flag);
    const arrow = flag.at === 'pos' ? '\u2191' : flag.at === 'neg' ? '\u2193' : '\u21C5';

    html += `
      <div class="am-card" data-idx="${idx}"
        style="background:var(--bg-elevated);border:1px solid var(--border);border-left:4px solid ${bc};border-radius:var(--radius);padding:14px;display:flex;flex-direction:column;gap:7px;">
        <div class="am-card-category"
          style="font-family:var(--font-display);font-size:9px;color:var(--text-muted);letter-spacing:0.6px;text-transform:uppercase;">${flag.section}</div>
        <div class="am-card-name"
          style="font-family:var(--font-display);font-size:12px;font-weight:700;color:var(--text-primary);line-height:1.3;">${flag.name}</div>
        <div class="am-card-month"
          style="font-family:var(--font-display);font-size:10px;color:var(--text-muted);">${flag.worstFlagMonth}</div>
        <div class="am-card-movement"
          style="font-family:var(--font-display);font-size:16px;font-weight:800;color:${mc};">${arrow} ${_fmtAmt(flag.movement)}</div>
        <div class="am-card-trigger"
          style="font-family:var(--font-display);font-size:9px;color:var(--text-muted);letter-spacing:0.4px;">${_triggerLabel(flag)}</div>
        <div style="display:flex;gap:6px;margin-top:4px;">
          <button class="am-btn-explain" data-idx="${idx}"
            style="flex:1;${baseBtn}background:var(--accent);border:1px solid var(--accent);color:var(--bg-base);font-weight:700;">View Explanation</button>
          <button class="am-btn-deep" data-idx="${idx}"
            style="${baseBtn}background:var(--bg-base);border:1px solid var(--border);color:var(--text-muted);">Deep Research</button>
        </div>
      </div>`;
  });

  html += '</div>'; // end grid
  container.innerHTML = html;

  // Store for event handlers
  container._amFlags   = allFlags;
  container._amResults = results;
  container._amMonths  = months;
  container._amPP      = purchasePrice;

  // ── event wiring ──────────────────────────────────────────

  container.querySelectorAll('.am-view-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      window._amViewMode = btn.dataset.view;
      renderAMAnalyzer(results, months, purchasePrice, containerId);
    });
  });

  container.querySelectorAll('.am-limit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      window._amLimit = parseInt(btn.dataset.limit, 10);
      renderAMAnalyzer(results, months, purchasePrice, containerId);
    });
  });

  // "View Explanation" — calls fetchAMReasoning + renderAMDetailPanel (added later)
  container.querySelectorAll('.am-btn-explain').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx  = parseInt(btn.dataset.idx, 10);
      const flag = allFlags[idx];
      if (!flag) return;

      // Derive property metadata from existing UI inputs
      const stateVal  = document.getElementById('aiState')?.value || '';
      const stateAbbr = (typeof Context !== 'undefined' && Context.STATE_ABBR)
        ? (Context.STATE_ABBR[stateVal] || '')
        : '';
      const city         = document.getElementById('aiCity')?.value || '';
      const propertyName = window._currentFileName || '';
      const breakdown    = _metricBreakdownForFlag(flag);

      // Show loading state in detail panel if renderAMDetailPanel already defined
      if (typeof renderAMDetailPanel === 'function') {
        renderAMDetailPanel(null, flag, breakdown, months);
      }

      try {
        const apiResponse = await fetchAMReasoning(
          flag, breakdown, stateAbbr, city, propertyName, purchasePrice, months
        );
        if (typeof renderAMDetailPanel === 'function') {
          renderAMDetailPanel(apiResponse, flag, breakdown, months);
        }
      } catch (e) {
        console.warn('[am-btn-explain] fetchAMReasoning failed:', e);
      }
    });
  });

  // "Deep Research" — replicates ai-engine.js ai-deep-btn pattern via #sidePanel
  container.querySelectorAll('.am-btn-deep').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx  = parseInt(btn.dataset.idx, 10);
      const flag = allFlags[idx];
      if (!flag) return;

      const r = flag.result?.res?.[flag.worstIdx];
      if (!r) return;

      const panel = document.getElementById('sidePanel');
      const body  = document.getElementById('sidePanelBody');
      if (!panel || !body) return;

      panel.classList.remove('hidden');
      body.innerHTML =
        `<div style="margin-bottom:12px;font-family:var(--font-display);font-size:13px;font-weight:700;color:var(--text-primary);">${flag.name} \u2014 ${flag.worstFlagMonth}</div>` +
        `<div class="ai-loading"><span class="spinner"></span> Claude is analyzing\u2026</div>` +
        `<div id="aiDeepResult"></div>`;

      const anomaly = {
        metric:      flag.name,
        month:       flag.worstFlagMonth,
        value:       r.v,
        zScore:      r.z != null ? r.z.toFixed(3) : null,
        method:      r.zm,
        direction:   r.at === 'pos' ? 'positive' : 'negative',
        isMaterial:  r.mat,
        isSeasonal:  r.st === 'seas',
        change:      r.chv,
        threshold:   flag.result?.th,
        metricType:  flag.result?.mt,
        section:     flag.result?.sec,
      };

      const ctx = typeof getAIContext === 'function' ? getAIContext() : {};
      const ctxStr = (typeof buildDataContext === 'function' ? (window.cachedContext || buildDataContext()) : '');

      fetch('/api/analyze-reasons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'explain', context: ctxStr, anomaly, ...ctx }),
      })
      .then(res => { if (!res.ok) throw new Error('API error ' + res.status); return res.json(); })
      .then(data => {
        const deepEl = document.getElementById('aiDeepResult');
        if (!deepEl) return;
        let h = '';
        if (data.primaryReason) {
          h += `<div class="ai-card"><div class="ai-card-primary"><strong>${data.primaryReason.category || ''}:</strong> ${data.primaryReason.explanation || ''}</div></div>`;
        }
        if (data.alternatives?.length) {
          h += '<div class="ai-card"><div class="ai-card-alts">';
          data.alternatives.forEach((a, i) => {
            h += `<div><strong>${i + 1}. ${a.category || ''}:</strong> ${a.explanation || ''}</div>`;
          });
          h += '</div></div>';
        }
        if (data.recommendation) {
          h += `<div class="ai-insight"><p><strong>Recommendation:</strong> ${data.recommendation}</p></div>`;
        }
        if (!h) h = `<div class="ai-card"><div class="ai-card-primary">${data.raw || JSON.stringify(data)}</div></div>`;
        deepEl.innerHTML = h;
      })
      .catch(e => {
        const deepEl = document.getElementById('aiDeepResult');
        if (deepEl) deepEl.innerHTML = `<div class="ai-error">Analysis failed: ${e.message}</div>`;
      });
    });
  });
}

// ── renderAMDetailPanel ───────────────────────────────────────

function renderAMDetailPanel(apiResponse, flag, metricBreakdown, months) {
  // ── create or reuse panel (same CSS classes as #sidePanel) ──
  let panel = document.getElementById('amDetailPanel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'amDetailPanel';
    panel.className = 'side-panel';
    panel.style.cssText = 'z-index:220;transform:translateX(100%);transition:transform 0.25s ease;';
    panel.innerHTML =
      '<div class="side-panel-header">' +
        '<h3 style="font-family:var(--font-display);font-size:11px;font-weight:700;letter-spacing:1px;color:var(--text-primary);margin:0;">ASSET DETAIL</h3>' +
        '<button class="ai-panel-close" id="amDetailClose" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:16px;padding:4px 8px;line-height:1;">&#x2715;</button>' +
      '</div>' +
      '<div class="side-panel-body" id="amDetailBody"></div>';
    document.body.appendChild(panel);
    panel.querySelector('#amDetailClose').addEventListener('click', () => {
      panel.style.transform = 'translateX(100%)';
    });
  }

  // Slide in
  panel.style.transform = 'translateX(0)';
  const body = document.getElementById('amDetailBody');

  // Show loading state while apiResponse is null
  if (!apiResponse && flag) {
    body.innerHTML =
      '<div style="font-family:var(--font-display);font-size:11px;color:var(--text-muted);padding:20px 0;">' +
      flag.name + ' \u2014 ' + flag.worstFlagMonth + '</div>' +
      '<div class="ai-loading"><span class="spinner"></span> Fetching analysis\u2026</div>';
    return;
  }

  let html = '';

  // Header
  if (flag) {
    html += '<div style="font-family:var(--font-display);font-size:13px;font-weight:700;color:var(--text-primary);margin-bottom:4px;">' + (flag.name || '') + '</div>';
    html += '<div style="font-family:var(--font-display);font-size:10px;color:var(--text-muted);margin-bottom:16px;">' + (flag.worstFlagMonth || '') + ' \u00b7 ' + _triggerLabel(flag) + '</div>';
  }

  // ── renderReasonPanel output (if available) ───────────────
  if (typeof window.renderReasonPanel === 'function' && apiResponse) {
    html += window.renderReasonPanel(apiResponse);
  }

  // ── T3 visual: 12 colored boxes ───────────────────────────
  if (flag && flag.result && months && months.length) {
    const winLen  = Math.min(months.length, 12);
    const startMi = months.length - winLen; // absolute month index of first box
    const res     = flag.result.res;

    // Per-box background: determine which T3 window(s) each position belongs to
    function boxBg(j) {
      const inCurrent = j >= winLen - 3;               // t3Indices
      const inPrior   = j >= winLen - 4 && j <= winLen - 2; // t3PriorIndices
      if (inCurrent && inPrior)
        return 'linear-gradient(135deg,var(--blue) 50%,var(--orange) 50%)';
      if (inCurrent) return 'var(--blue)';
      if (inPrior)   return 'var(--orange)';
      return 'var(--bg-elevated)';
    }

    html += '<div style="margin-bottom:16px;">';
    html += '<div style="font-family:var(--font-display);font-size:9px;font-weight:700;letter-spacing:1px;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px;">T3 Rolling Window</div>';
    html += '<div style="display:flex;gap:3px;align-items:flex-end;">';

    for (let j = 0; j < winLen; j++) {
      const mi    = startMi + j;
      const entry = res[mi];
      const v     = entry?.v;
      const bg    = boxBg(j);
      const label = (months[mi] || '').split(' ')[0]; // month abbrev only
      const valStr = v != null ? _fmtAmt(v) : '';

      html +=
        '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;">' +
          '<div style="font-family:var(--font-display);font-size:8px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:34px;text-align:center;">' + valStr + '</div>' +
          '<div style="height:28px;width:100%;border-radius:3px;background:' + bg + ';"></div>' +
          '<div style="font-family:var(--font-display);font-size:8px;color:var(--text-muted);">' + label + '</div>' +
        '</div>';
    }

    html += '</div>'; // flex row

    // Legend
    html +=
      '<div style="display:flex;gap:12px;margin-top:8px;">' +
        '<div style="display:flex;align-items:center;gap:4px;font-family:var(--font-display);font-size:9px;color:var(--text-muted);">' +
          '<span style="width:10px;height:10px;background:var(--blue);display:inline-block;border-radius:2px;"></span>T3 current</div>' +
        '<div style="display:flex;align-items:center;gap:4px;font-family:var(--font-display);font-size:9px;color:var(--text-muted);">' +
          '<span style="width:10px;height:10px;background:var(--orange);display:inline-block;border-radius:2px;"></span>T3 prior</div>' +
        '<div style="display:flex;align-items:center;gap:4px;font-family:var(--font-display);font-size:9px;color:var(--text-muted);">' +
          '<span style="width:10px;height:10px;background:var(--bg-elevated);border:1px solid var(--border);display:inline-block;border-radius:2px;"></span>T12 baseline</div>' +
      '</div>';

    html += '</div>'; // T3 section
  }

  // ── Driver breakdown table ────────────────────────────────
  if (metricBreakdown && metricBreakdown.length) {
    const thStyle = 'padding:5px 8px;text-align:right;font-family:var(--font-display);font-size:9px;font-weight:700;letter-spacing:0.5px;color:var(--text-muted);text-transform:uppercase;border-bottom:1px solid var(--border);white-space:nowrap;';
    const thLeft  = thStyle.replace('text-align:right', 'text-align:left');
    const tdStyle = 'padding:5px 8px;text-align:right;font-family:var(--font-display);font-size:10px;color:var(--text-secondary);border-bottom:1px solid var(--border);white-space:nowrap;';
    const tdLeft  = tdStyle.replace('text-align:right', 'text-align:left') + 'color:var(--text-primary);max-width:130px;overflow:hidden;text-overflow:ellipsis;';
    const tdBold  = tdStyle + 'font-weight:700;color:var(--text-primary);border-bottom:none;border-top:2px solid var(--border);';
    const tdBoldL = tdBold.replace('text-align:right', 'text-align:left');

    html += '<div style="margin-bottom:16px;">';
    html += '<div style="font-family:var(--font-display);font-size:9px;font-weight:700;letter-spacing:1px;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px;">Driver Breakdown</div>';
    html += '<div style="overflow-x:auto;">';
    html += '<table style="width:100%;border-collapse:collapse;">';
    html += '<thead><tr>';
    html += '<th style="' + thLeft  + '">Metric</th>';
    html += '<th style="' + thStyle + '">T3 Current</th>';
    html += '<th style="' + thStyle + '">T3 Prior</th>';
    html += '<th style="' + thStyle + '">T12</th>';
    html += '</tr></thead><tbody>';

    let sumCurrent = 0, sumPrior = 0, sumT12 = 0;
    let hasPrior = false, hasT12 = false;

    for (const m of metricBreakdown) {
      const cur = m.T3current ?? m.T3_current ?? null;
      const pri = m.T3prior   ?? m.T3_prior   ?? null;
      const t12 = m.T12       ?? null;
      if (cur != null) { sumCurrent += cur; }
      if (pri != null) { sumPrior   += pri; hasPrior = true; }
      if (t12 != null) { sumT12     += t12; hasT12   = true; }
      const diff = cur != null && pri != null ? cur - pri : null;
      const curColor = diff == null ? 'color:var(--text-secondary)' : diff > 0 ? 'color:var(--green)' : 'color:var(--red)';
      html += '<tr>';
      html += '<td style="' + tdLeft  + '">' + (m.name || '') + '</td>';
      html += '<td style="' + tdStyle + ';' + curColor + '">' + (cur != null ? _fmtAmt(cur) : '\u2014') + '</td>';
      html += '<td style="' + tdStyle + '">' + (pri != null ? _fmtAmt(pri) : '\u2014') + '</td>';
      html += '<td style="' + tdStyle + '">' + (t12 != null ? _fmtAmt(t12) : '\u2014') + '</td>';
      html += '</tr>';
    }

    if (metricBreakdown.length > 1) {
      html += '<tr>';
      html += '<td style="' + tdBoldL + '">Total</td>';
      html += '<td style="' + tdBold  + '">' + _fmtAmt(sumCurrent) + '</td>';
      html += '<td style="' + tdBold  + '">' + (hasPrior ? _fmtAmt(sumPrior) : '\u2014') + '</td>';
      html += '<td style="' + tdBold  + '">' + (hasT12   ? _fmtAmt(sumT12)   : '\u2014') + '</td>';
      html += '</tr>';
    }

    html += '</tbody></table></div></div>'; // end table section
  }

  // ── Reasoning text ────────────────────────────────────────
  if (apiResponse?.reasoning) {
    html +=
      '<div style="margin-bottom:16px;">' +
        '<div style="font-family:var(--font-display);font-size:9px;font-weight:700;letter-spacing:1px;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px;">Analysis</div>' +
        '<div style="font-family:var(--font-body,var(--font-display));font-size:11px;color:var(--text-primary);line-height:1.7;">' +
          apiResponse.reasoning.replace(/\n/g, '<br>') +
        '</div>' +
      '</div>';
  }

  body.innerHTML = html;
}

// ── fetchAMReasoning ──────────────────────────────────────────

async function fetchAMReasoning(flag, metricBreakdown, stateAbbr, city, propertyName, purchasePrice, months) {
  const payload = {
    categoryName:      flag.name,
    section:           flag.section,
    monthLabel:        flag.worstMonthLabel || flag.worstFlagMonth,
    metricBreakdown,
    flag,
    stateAbbr,
    city,
    propertyName,
    purchasePrice,
    recentCategoryT3:  [],
  };
  try {
    const res = await fetch('/api/am-reasoning', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('am-reasoning returned ' + res.status);
    return await res.json();
  } catch (e) {
    console.warn('[fetchAMReasoning] failed:', e);
    throw e;
  }
}

window.renderAMAnalyzer = renderAMAnalyzer;
