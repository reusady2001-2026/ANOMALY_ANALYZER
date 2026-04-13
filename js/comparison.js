// ══════════════════════════════════════════════════════════════
// SECTION: Comparison Mode (runComp, renderComp, alignMultiData)
// ══════════════════════════════════════════════════════════════
var CVIEW="all",CFILT="all",CSEC="all",COMP_MAT_FOCUS=false,COMP_MT_FILTER="all";

function alignMultiData(props){
  // Find common months across ALL properties
  let common=null;
  props.forEach(p=>{
    if(!p.data||!p.data.months)throw new Error(`Property ${p.label} has no month data. Please re-upload the file.`);
    const ms=new Set(p.data.months);
    if(!common)common=ms;
    else common=new Set([...common].filter(m=>ms.has(m)));
  });
  const commonMonths=[...common].sort((a,b)=>{
    const pa=a.split(" "),pb=b.split(" ");
    const MS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return(parseInt(pa[1])*12+MS.indexOf(pa[0]))-(parseInt(pb[1])*12+MS.indexOf(pb[0]));
  });
  if(!commonMonths.length)throw new Error("No common months found across properties.");
  // Align each property
  return props.map(p=>{
    const idx=commonMonths.map(m=>p.data.months.indexOf(m));
    return{...p,alignedData:{months:commonMonths,metrics:p.data.metrics.map(m=>({...m,values:idx.map(i=>m.values[i])}))}};
  });
}

function runComp(){
  const ready=compProperties.filter(p=>p.data||p.results);
  if(ready.length<2){return;}
  // Validate
  for(const p of compProperties){
    const pp=getP(`compPP_${p.id}`);
    const st=document.getElementById(`compState_${p.id}`)?.value;
    const ct=document.getElementById(`compCity_${p.id}`)?.value;
    if(pp<=0){alert(`Enter Purchase Price for Property ${p.label}`);return;}
    if(!st){alert(`Select State for Property ${p.label}`);return;}
    if(!ct){alert(`Enter City for Property ${p.label}`);return;}
    if(pp>0)savePriceToHistory(pp);
  }

  let aligned;
  if (PLATFORM === 'asset') {
    try { aligned = alignMultiData(compProperties); } catch(ex) { document.getElementById('compError').textContent=ex.message; document.getElementById('compError').style.display=''; return; }
    renderAMComparison(aligned, aligned[0].alignedData.months, null);
    return;
  }
  // Reconstruct raw metrics from saved results for properties loaded via Analyzer session history.
  // p.data.metrics may be an empty stub when DATA was null at save time; p.results has the
  // full analysis. Rebuild metrics so alignMultiData has real months+values to work with.
  compProperties.forEach(p=>{
    const willReconstruct=p.data&&!p.data.metrics?.length&&p.sliced?.months&&p.results?.length;
    if(willReconstruct){
      p.data.months=p.sliced.months;
      p.data.metrics=p.results.map(r=>({name:r.name,values:r.res.map(x=>x.v),isIncome:r.isInc,section:r.sec}));
    }
  });
  try{
    aligned=alignMultiData(compProperties);
  }catch(ex){
    document.getElementById("compError").textContent=ex.message;document.getElementById("compError").style.display="";return;
  }

  const commonMonths=aligned[0].alignedData.months;
  populatePeriod("compPeriodFrom","compPeriodTo",commonMonths);

  const[fi,ti]=getPeriodIndices("compPeriodFrom","compPeriodTo");
  const maxTo=commonMonths.length-SKIP-1;
  const isFullRange=(fi===0&&ti>=maxTo);
  const sk=isFullRange?SKIP:0;

  aligned.forEach(p=>{
    const sl=isFullRange?p.alignedData:sliceData(p.alignedData,fi,Math.min(ti,maxTo));
    p.sliced=sl;
    // Safety net: if metrics are still empty after reconstruction attempt but saved results
    // exist, keep the saved results rather than overwriting with [].
    if(p.results&&p.results.length&&!p.data?.metrics?.length){return;}
    const pp=getP(`compPP_${p.id}`);
    const engine=PLATFORM==="asset"?analyzeAsset:analyze;
    p.results=sl.metrics.map(m=>engine(m.name,m.values,sl.months,m.isIncome,pp,sk)).filter(Boolean);
  });

  window._compAligned=aligned;window._compSkip=sk;
  renderComp();
  // Show chat bar for comparison too
  document.getElementById("chatBar").classList.remove("hidden");
  // Build combined context for chat
  cachedContext=null;
  const allResults=[];aligned.forEach(p=>{if(p.results)allResults.push(...p.results);});
  RESULTS=allResults; // temporarily set for buildDataContext
  cachedContext=buildDataContext();
  // Run reason engine for each property
  runCompReasonEngines(aligned);
}

function renderComp(){
  if(window._compObserver){window._compObserver.disconnect();window._compObserver=null;}
  window._compMergedRows=[];window._compRendered=0;
  const aligned=window._compAligned;if(!aligned||!aligned.length)return;
  ["compFilters","compStats","compLegend","compTableWrap"].forEach(id=>document.getElementById(id).classList.remove("hidden"));
  document.getElementById("compLegend").innerHTML=PLATFORM==="asset"
    ?'<span class="legend-item"><span class="legend-box" style="background:#b91c1c;"></span> Material ↓</span><span class="legend-item"><span class="legend-box" style="background:#15803d;"></span> Material ↑</span><span class="legend-item"><span class="legend-box" style="background:#b45309;"></span> Seasonal</span><span class="legend-item"><span class="src-badge src-a">A</span> / <span class="src-badge src-b">B</span> Source</span>'
    :'<span class="legend-item"><span class="legend-box" style="background:#b91c1c;"></span> Material ↓</span><span class="legend-item"><span class="legend-box" style="background:#15803d;"></span> Material ↑</span><span class="legend-item"><span class="legend-box" style="outline:2px solid #ea580c;outline-offset:-2px;"></span> Anomaly</span><span class="legend-item"><span class="legend-box" style="background:#b45309;"></span> Seasonal</span><span class="legend-item"><span class="legend-box" style="outline:2px solid #8b5cf6;outline-offset:-2px;"></span> Δ Outlier</span><span class="legend-item"><span class="src-badge src-a">A</span> / <span class="src-badge src-b">B</span> Source</span>';

  // Asset mode: only All / Material filters are valid
  if(PLATFORM==="asset"&&(CFILT==="anom"||CFILT==="seas"))CFILT="all";
  document.querySelectorAll("[data-cfilt]").forEach(b=>{
    const f=b.dataset.cfilt;
    const hide=PLATFORM==="asset"&&(f==="anom"||f==="seas");
    b.style.display=hide?"none":"";
    if(f==="mat")b.textContent=PLATFORM==="asset"?"Material Anomalies":"Material";
  });
  document.getElementById("compMatFocusBtn").closest(".ctrl-group").style.display=PLATFORM==="asset"?"none":"";

  // Stats
  let statsH="";
  aligned.forEach(p=>{
    if(!p.results)return;
    const nm=document.getElementById(`compName_${p.id}`)?.value||p.label;
    const st=getStats(p.results);
    statsH+=`<div class="comp-stats-block"><h3><span class="src-badge" style="background:${p.color}">${p.label}</span> ${nm}</h3><div class="cards">${statsHTML(st)}</div></div>`;
  });
  document.getElementById("compStats").innerHTML=statsH;

  // Merge all metric names
  const allNames=new Set();
  aligned.forEach(p=>{if(p.results)p.results.forEach(r=>allNames.add(r.name));});
  let merged=[...allNames].map(name=>{
    const entries={};
    aligned.forEach(p=>{if(p.results){const r=p.results.find(x=>x.name===name);if(r)entries[p.id]=r;}});
    return{name,entries};
  });

  // Filters
  if(CSEC!=="all")merged=merged.filter(m=>Object.values(m.entries).some(r=>r.sec===CSEC));
  if(CFILT==="anom")merged=merged.filter(m=>Object.values(m.entries).some(r=>r.res.some(x=>x.st==="anom"||x.st==="seas")));
  if(CFILT==="mat")merged=merged.filter(m=>Object.values(m.entries).some(r=>r.res.some(x=>x.mat||x.seas)));
  if(CFILT==="seas")merged=merged.filter(m=>Object.values(m.entries).some(r=>r.res.some(x=>x.seas||x.st==="seas"||x.recur)));
  if(COMP_MT_FILTER!=="all")merged=merged.filter(m=>Object.values(m.entries).some(r=>r.mt===COMP_MT_FILTER));

  const months=aligned[0].sliced?aligned[0].sliced.months:aligned[0].alignedData.months;
  const csk=window._compSkip!=null?window._compSkip:SKIP;
  let thead=`<thead><tr><th class="metric-col">Metric</th><th class="src-col">Src</th><th class="type-col">Type</th>`;
  months.forEach((m,i)=>thead+=`<th class="${i>=months.length-csk&&csk>0?"skip-col":""}" style="font-size:8px;">${m}</th>`);
  thead+=`<th class="trend-col">Trend</th><th class="trend-col">12M</th><th class="trend-col">3M</th><th class="quarter-col">Str Q</th><th class="quarter-col">Wk Q</th></tr></thead>`;

  // Warn before rendering — estimate without generating any HTML
  const estRows=merged.length*(aligned.length+(CVIEW==="all"?1:0));
  if(estRows>200){
    statsH+=`<div style="padding:8px 0;font-size:10px;color:var(--orange);">⚠ ~${estRows} rows — use Anomalies or Material filter for best performance.</div>`;
    document.getElementById("compStats").innerHTML=statsH;
  }

  document.getElementById("compTable").innerHTML=thead+`<tbody id="compTbody"></tbody>`;
  const tbody=document.getElementById("compTbody");
  const sentinel=document.createElement('tr');
  sentinel.id='compSentinel';
  sentinel.innerHTML=`<td colspan="999" style="height:1px;"></td>`;
  const BATCH=40; // metrics per frame — each metric generates 2-3 rows

  // Build HTML for a single metric entry (prop rows + delta row).
  // Called inside requestAnimationFrame so heavy renderCells() work is deferred.
  function buildMetricRows(m){
    const rows=[];
    const propIds=aligned.filter(p=>m.entries[p.id]);
    propIds.forEach(p=>{
      const r=m.entries[p.id];
      if(!r)return;
      if(CVIEW!=="all"&&CVIEW!==p.label.toLowerCase())return;
      const lc=r.sec==="income"?"income-label":"expense-label";
      rows.push(`<tr style="background:${p.color}11;"><td class="metric-cell ${lc}" style="background:${p.color}18;">${r.name}</td><td class="type-cell"><span class="src-badge" style="background:${p.color}">${p.label}</span></td><td class="type-cell">${r.mt==="sporadic"?"SPR":r.mt==="structural-change"?"STC":"CNT"}</td>${renderCells(r,COMP_MAT_FOCUS)}<td class="trend-cell">${trendHTML(r.tr.all)}</td><td class="trend-cell">${trendHTML(r.tr.m12)}</td><td class="trend-cell">${trendHTML(r.tr.m3)}</td><td class="q-cell">${r.sq?r.sq.k:"—"}</td><td class="q-cell">${r.wq?r.wq.k:"—"}</td></tr>`);
    });
    // Delta row: % difference between first two properties
    if(propIds.length>=2&&CVIEW==="all"){
      const rA=m.entries[propIds[0].id];
      const rB=m.entries[propIds[1].id];
      if(rA&&rB){
        let deltaH=`<tr class="row-delta" style="background:rgba(139,92,246,0.06);"><td class="metric-cell" style="color:var(--purple);font-style:italic;font-size:9px;background:rgba(139,92,246,0.08);">Δ%</td><td class="type-cell"></td><td class="type-cell"></td>`;
        const deltas=[];
        for(let i=0;i<months.length;i++){
          const vA=rA.res[i]?.v;const vB=rB.res[i]?.v;
          const skip=i>=months.length-csk&&csk>0;
          if(skip||vA==null||vB==null){deltas.push(null);continue;}
          if(vB===0&&vA===0){deltas.push(0);continue;}
          if(vB===0){deltas.push(null);continue;}
          deltas.push(((vA-vB)/Math.abs(vB))*100);
        }
        const validDeltas=deltas.filter(d=>d!==null);
        const dMean=validDeltas.length?validDeltas.reduce((a,b)=>a+b,0)/validDeltas.length:0;
        const dSD=validDeltas.length>1?Math.sqrt(validDeltas.reduce((a,v)=>a+(v-dMean)**2,0)/validDeltas.length):0;
        for(let i=0;i<months.length;i++){
          const skip=i>=months.length-csk&&csk>0;const d=deltas[i];
          if(skip){deltaH+=`<td class="delta-cell cell-skip">—</td>`;continue;}
          if(d===null){deltaH+=`<td class="delta-cell">—</td>`;continue;}
          const isOutlier=dSD>0&&Math.abs((d-dMean)/dSD)>1.5;
          const col=d>0?"var(--green)":d<0?"var(--red)":"var(--text-muted)";
          deltaH+=`<td class="delta-cell${isOutlier?" delta-outlier":""}" style="color:${col}">${d>=0?"+":""}${d.toFixed(1)}%</td>`;
        }
        deltaH+=`<td class="delta-cell"></td><td class="delta-cell"></td><td class="delta-cell"></td><td class="delta-cell"></td><td class="delta-cell"></td></tr>`;
        rows.push(deltaH);
      }
    }
    return rows;
  }

  function renderNextBatch(){
    const start=window._compRendered;
    if(start>=merged.length){sentinel.remove();return;}
    if(sentinel.parentNode)sentinel.remove();
    requestAnimationFrame(()=>{
      const rowHtml=[];
      const end=Math.min(start+BATCH,merged.length);
      for(let i=start;i<end;i++)rowHtml.push(...buildMetricRows(merged[i]));
      const frag=document.createDocumentFragment();
      const tmp=document.createElement('tbody');
      tmp.innerHTML=rowHtml.join('');
      while(tmp.firstChild)frag.appendChild(tmp.firstChild);
      tbody.appendChild(frag);
      window._compRendered=end;
      if(window._compRendered<merged.length)tbody.appendChild(sentinel);
    });
  }

  const observer=new IntersectionObserver((entries)=>{
    if(entries[0].isIntersecting)renderNextBatch();
  },{rootMargin:'200px'});

  if(window._compObserver)window._compObserver.disconnect();
  window._compObserver=observer;

  renderNextBatch();
  requestAnimationFrame(()=>{
    if(window._compRendered<merged.length){
      tbody.appendChild(sentinel);
      observer.observe(sentinel);
    }
  });
}

function renderAMComparison(aligned, months, purchasePrice) {
  if (window._amCompViewMode === undefined) window._amCompViewMode = 'metric';
  if (window._amCompLimit    === undefined) window._amCompLimit    = 25;

  // Render into a sub-container inside #compMode (create/reuse)
  let target = document.getElementById('amCompResult');
  if (!target) {
    target = document.createElement('div');
    target.id = 'amCompResult';
    target.style.cssText = 'margin-top:16px;';
    const wrap = document.getElementById('compTableWrap');
    if (wrap) wrap.parentElement.insertBefore(target, wrap);
  }
  target.style.display = '';
  document.getElementById('compTableWrap').classList.add('hidden');

  // Build flags per property
  const propFlags = aligned.map(p => {
    const results   = p.results || [];
    const propMonths = (p.sliced || p.alignedData).months || months;
    return {
      prop:     p,
      months:   propMonths,
      flags:    window._amCompViewMode === 'category'
                  ? _buildCategoryFlags(results, propMonths)
                  : _buildMetricFlags(results, propMonths),
    };
  });

  // Delta map — matching names whose movement delta exceeds threshold
  const ppA    = purchasePrice != null ? purchasePrice : getP('compPP_' + (aligned[0]?.id || ''));
  const matTh  = (ppA || 0) * 0.001;
  const deltaMap = new Map();
  if (propFlags.length >= 2) {
    for (const fA of propFlags[0].flags) {
      const fB = propFlags[1].flags.find(f => f.name === fA.name);
      if (!fB) continue;
      const diff = fA.movement - fB.movement;
      if (Math.abs(diff) >= matTh) deltaMap.set(fA.name, { fA, fB, diff });
    }
  }

  const baseBtn = 'font-family:var(--font-display);font-size:10px;padding:5px 11px;border-radius:var(--radius);cursor:pointer;letter-spacing:0.3px;transition:opacity 0.15s;';
  function actSty(on) {
    return on
      ? 'background:var(--accent);border:1px solid var(--accent);color:var(--bg-base);'
      : 'background:var(--bg-elevated);border:1px solid var(--border);color:var(--text-muted);';
  }

  // ── Toolbar ───────────────────────────────────────────────
  let html = '<div style="display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:18px;">';
  html += '<div style="display:flex;gap:4px;">';
  html += `<button class="am-cmp-toggle" data-view="metric"   style="${baseBtn}${actSty(window._amCompViewMode==='metric')}">&#x1F4CA; View by Metric</button>`;
  html += `<button class="am-cmp-toggle" data-view="category" style="${baseBtn}${actSty(window._amCompViewMode==='category')}">&#x1F5C2; View by Category</button>`;
  html += '</div><div style="display:flex;align-items:center;gap:4px;margin-left:auto;">';
  html += '<span style="font-family:var(--font-display);font-size:9px;color:var(--text-muted);letter-spacing:0.5px;">SHOW</span>';
  for (const lv of [10, 25, 50, 100]) {
    html += `<button class="am-cmp-lim" data-limit="${lv}" style="${baseBtn}${actSty(window._amCompLimit===lv)}">${lv}</button>`;
  }
  html += '</div></div>';

  // ── Two-column property grid ──────────────────────────────
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px;">';

  for (const pf of propFlags) {
    const p    = pf.prop;
    const disp = pf.flags.slice(0, window._amCompLimit);
    const nm   = document.getElementById('compName_' + p.id)?.value || p.label;

    html += '<div>';
    html +=
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid var(--border);">' +
      `<span style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:4px;background:${p.color};font-family:var(--font-display);font-size:10px;font-weight:700;color:#fff;">${p.label}</span>` +
      `<span style="font-family:var(--font-display);font-size:12px;font-weight:700;color:var(--text-primary);">${nm}</span>` +
      `<span style="font-family:var(--font-display);font-size:9px;color:var(--text-muted);margin-left:auto;">${pf.flags.length} flagged</span>` +
      '</div>';

    if (!disp.length) {
      html += '<div style="font-family:var(--font-display);font-size:11px;color:var(--text-muted);padding:20px 0;text-align:center;">No material anomalies.</div>';
    }

    html += '<div style="display:flex;flex-direction:column;gap:10px;">';
    disp.forEach((flag, idx) => {
      const bc    = _borderColor(flag);
      const mc    = _movementColor(flag);
      const arrow = flag.at === 'pos' ? '\u2191' : flag.at === 'neg' ? '\u2193' : '\u21C5';
      const delta = deltaMap.get(flag.name);
      html +=
        `<div class="am-card" data-propid="${p.id}" data-idx="${idx}"` +
        ` style="background:var(--bg-elevated);border:1px solid var(--border);border-left:4px solid ${bc};border-radius:var(--radius);padding:12px;display:flex;flex-direction:column;gap:6px;">` +
        `<div class="am-card-category" style="font-family:var(--font-display);font-size:9px;color:var(--text-muted);letter-spacing:0.6px;text-transform:uppercase;">${flag.section}</div>` +
        `<div class="am-card-name" style="font-family:var(--font-display);font-size:11px;font-weight:700;color:var(--text-primary);">${flag.name}` +
          (delta ? ' <span style="font-size:9px;color:var(--purple);">\u0394</span>' : '') +
        '</div>' +
        `<div class="am-card-month" style="font-family:var(--font-display);font-size:10px;color:var(--text-muted);">${flag.worstFlagMonth}</div>` +
        `<div class="am-card-movement" style="font-family:var(--font-display);font-size:14px;font-weight:800;color:${mc};">${arrow} ${_fmtAmt(flag.movement)}</div>` +
        `<div class="am-card-trigger" style="font-family:var(--font-display);font-size:9px;color:var(--text-muted);letter-spacing:0.4px;">${_triggerLabel(flag)}</div>` +
        '<div style="display:flex;gap:5px;margin-top:3px;">' +
        `<button class="am-cmp-explain" data-propid="${p.id}" data-idx="${idx}" style="flex:1;${baseBtn}background:var(--accent);border:1px solid var(--accent);color:var(--bg-base);font-weight:700;font-size:9px;">View Explanation</button>` +
        `<button class="am-cmp-deep"    data-propid="${p.id}" data-idx="${idx}" style="${baseBtn}background:var(--bg-base);border:1px solid var(--border);color:var(--text-muted);font-size:9px;">Deep Research</button>` +
        '</div></div>';
    });
    html += '</div></div>'; // close cards list + property column
  }

  html += '</div>'; // close two-column grid

  // ── Delta cards ───────────────────────────────────────────
  if (deltaMap.size) {
    html += '<div style="margin-top:8px;">';
    html +=
      '<div style="font-family:var(--font-display);font-size:9px;font-weight:700;letter-spacing:1px;' +
      'color:var(--purple);text-transform:uppercase;margin-bottom:12px;">\u0394 Delta Metrics</div>';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;">';
    for (const [name, { fA, fB, diff }] of deltaMap) {
      const mc    = diff > 0 ? 'var(--green)' : 'var(--red)';
      const arrow = diff > 0 ? '\u2191' : '\u2193';
      html +=
        '<div class="am-delta-card" style="background:var(--bg-elevated);border:1px solid var(--border);' +
        'border-left:4px solid var(--purple);border-radius:var(--radius);padding:12px;display:flex;flex-direction:column;gap:5px;">' +
        '<div style="font-family:var(--font-display);font-size:9px;color:var(--purple);letter-spacing:0.5px;text-transform:uppercase;">\u0394 Delta</div>' +
        `<div style="font-family:var(--font-display);font-size:11px;font-weight:700;color:var(--text-primary);">${name}</div>` +
        `<div style="font-family:var(--font-display);font-size:9px;color:var(--text-muted);">${aligned[0].label} vs ${aligned[1].label}</div>` +
        `<div style="font-family:var(--font-display);font-size:14px;font-weight:800;color:${mc};">${arrow} ${_fmtAmt(Math.abs(diff))}</div>` +
        `<div style="font-family:var(--font-display);font-size:9px;color:var(--text-muted);">${_fmtAmt(fA.movement)} vs ${_fmtAmt(fB.movement)}</div>` +
        '</div>';
    }
    html += '</div></div>';
  }

  target.innerHTML = html;

  // Store for handlers
  target._amCmpPropFlags = propFlags;
  target._amCmpAligned   = aligned;

  // ── Event wiring ──────────────────────────────────────────
  target.querySelectorAll('.am-cmp-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      window._amCompViewMode = btn.dataset.view;
      renderAMComparison(aligned, months, purchasePrice);
    });
  });

  target.querySelectorAll('.am-cmp-lim').forEach(btn => {
    btn.addEventListener('click', () => {
      window._amCompLimit = parseInt(btn.dataset.limit, 10);
      renderAMComparison(aligned, months, purchasePrice);
    });
  });

  // "View Explanation" — reads compState_{id} and compCity_{id}
  target.querySelectorAll('.am-cmp-explain').forEach(btn => {
    btn.addEventListener('click', async () => {
      const propId = btn.dataset.propid;
      const idx    = parseInt(btn.dataset.idx, 10);
      const pf     = propFlags.find(x => String(x.prop.id) === propId);
      if (!pf) return;
      const flag = pf.flags[idx];
      if (!flag) return;

      const stateVal  = document.getElementById('compState_' + propId)?.value || '';
      const stateAbbr = (typeof Context !== 'undefined' && Context.STATE_ABBR)
        ? (Context.STATE_ABBR[stateVal] || '') : '';
      const city         = document.getElementById('compCity_' + propId)?.value || '';
      const propertyName = document.getElementById('compName_'  + propId)?.value || pf.prop.label;
      const pp           = purchasePrice != null ? purchasePrice : getP('compPP_' + propId);
      const breakdown    = _metricBreakdownForFlag(flag);

      if (typeof renderAMDetailPanel === 'function') renderAMDetailPanel(null, flag, breakdown, pf.months);

      try {
        const resp = await fetchAMReasoning(flag, breakdown, stateAbbr, city, propertyName, pp, pf.months);
        if (typeof renderAMDetailPanel === 'function') renderAMDetailPanel(resp, flag, breakdown, pf.months);
      } catch (e) {
        console.warn('[am-cmp-explain] failed:', e);
      }
    });
  });

  // "Deep Research" — same pattern as analyzer mode
  target.querySelectorAll('.am-cmp-deep').forEach(btn => {
    btn.addEventListener('click', () => {
      const propId = btn.dataset.propid;
      const idx    = parseInt(btn.dataset.idx, 10);
      const pf     = propFlags.find(x => String(x.prop.id) === propId);
      if (!pf) return;
      const flag = pf.flags[idx];
      if (!flag) return;
      const r = flag.result?.res?.[flag.worstIdx];
      if (!r) return;

      const panel = document.getElementById('sidePanel');
      const body  = document.getElementById('sidePanelBody');
      if (!panel || !body) return;

      panel.classList.remove('hidden');
      body.innerHTML =
        '<div style="margin-bottom:12px;font-family:var(--font-display);font-size:13px;font-weight:700;color:var(--text-primary);">' +
        flag.name + ' \u2014 ' + flag.worstFlagMonth + '</div>' +
        '<div class="ai-loading"><span class="spinner"></span> Claude is analyzing\u2026</div>' +
        '<div id="aiDeepResult"></div>';

      const anomaly = {
        metric: flag.name, month: flag.worstFlagMonth, value: r.v,
        zScore: r.z != null ? r.z.toFixed(3) : null, method: r.zm,
        direction: r.at === 'pos' ? 'positive' : 'negative',
        isMaterial: r.mat, isSeasonal: r.st === 'seas', change: r.chv,
        threshold: flag.result?.th, metricType: flag.result?.mt, section: flag.result?.sec,
      };
      const ctx    = typeof getAIContext    === 'function' ? getAIContext() : {};
      const ctxStr = typeof buildDataContext === 'function' ? (window.cachedContext || buildDataContext()) : '';

      fetch('/api/analyze-reasons', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({mode:'explain', context:ctxStr, anomaly, ...ctx}),
      })
      .then(res => { if(!res.ok) throw new Error('API error '+res.status); return res.json(); })
      .then(data => {
        const el = document.getElementById('aiDeepResult');
        if (!el) return;
        let h = '';
        if (data.primaryReason) h += `<div class="ai-card"><div class="ai-card-primary"><strong>${data.primaryReason.category||''}:</strong> ${data.primaryReason.explanation||''}</div></div>`;
        if (data.alternatives?.length) { h+='<div class="ai-card"><div class="ai-card-alts">'; data.alternatives.forEach((a,i)=>{h+=`<div><strong>${i+1}. ${a.category||''}:</strong> ${a.explanation||''}</div>`;}); h+='</div></div>'; }
        if (data.recommendation) h += `<div class="ai-insight"><p><strong>Recommendation:</strong> ${data.recommendation}</p></div>`;
        if (!h) h = `<div class="ai-card"><div class="ai-card-primary">${data.raw||JSON.stringify(data)}</div></div>`;
        el.innerHTML = h;
      })
      .catch(e => { const el=document.getElementById('aiDeepResult'); if(el) el.innerHTML=`<div class="ai-error">Analysis failed: ${e.message}</div>`; });
    });
  });
}

function showTip(el,idx){const met=window._filt?.[idx];if(!met||!window._data)return;const d=window._data,t=document.getElementById("tooltip");t.className="tooltip-bar visible";t.innerHTML=`<span><strong>${met.name}</strong></span><span>Type: <strong>${met.mt==="structural-change"?"STC":met.mt}</strong></span><span>Threshold: <strong>${met.th.toFixed(2)}</strong></span><span>Norm.Vol: <strong>${met.nv.toFixed(2)}</strong></span><span>Opening: <strong>${d.months[met.oi]||"—"}</strong></span>`;}
function hideTip(){document.getElementById("tooltip").className="tooltip-bar";}

function resetAll(){
  // Reset analyzer state
  DATA=null;RESULTS=null;FILTER="all";SEC_FILTER="all";MAT_FOCUS=false;MT_FILTER="all";
  window._sliced=null;window._slicedSkip=null;window._filt=null;window._data=null;
  document.getElementById("uploadBtn").textContent="Choose .xlsx / .csv";
  document.getElementById("ppInput").value="0";
  document.getElementById("thresholdInfo").textContent="10bps: $0/mo";
  document.getElementById("fileInput").value="";
  ["analyzerFilters","rerunBtn","statsRow","legendRow","tableWrap","chatBar"].forEach(id=>document.getElementById(id).classList.add("hidden"));
  const amEl=document.getElementById("assetMgmtMode");
  amEl.classList.add("hidden");amEl.innerHTML="";
  window._amViewMode=undefined;window._amLimit=undefined;
  document.getElementById("anomPopup").classList.add("hidden");
  document.getElementById("sidePanel").classList.add("hidden");
  document.getElementById("chatMessages").innerHTML="";
  chatHistory=[];
  document.getElementById("aiState").value="";
  document.getElementById("aiCity").value="";
  document.getElementById("mainTable").innerHTML="";
  document.getElementById("matFocusBtn").className="btn";
  document.querySelectorAll("[data-filter]").forEach((b,i)=>b.className=i===0?"btn btn-active":"btn");
  document.querySelectorAll("[data-sec]").forEach((b,i)=>b.className=i===0?"btn btn-sec-active":"btn");
  document.querySelectorAll("[data-mt]").forEach((b,i)=>b.className=i===0?"btn btn-active":"btn");
  document.querySelectorAll("[data-cmt]").forEach((b,i)=>b.className=i===0?"btn btn-active":"btn");
  // Reset comparison state
  CVIEW="all";CFILT="all";CSEC="all";COMP_MAT_FOCUS=false;COMP_MT_FILTER="all";
  window._compAligned=null;window._compSkip=null;
  // Remove all property cards and recreate 2
  document.getElementById("compProperties").innerHTML="";
  compProperties=[];compPropertyCounter=0;
  addCompProperty();addCompProperty();
  document.getElementById("compRunBtn").classList.add("hidden");
  ["compFilters","compStats","compLegend","compTableWrap"].forEach(id=>document.getElementById(id).classList.add("hidden"));
  document.getElementById("compTable").innerHTML="";
  if(window._compObserver){window._compObserver.disconnect();window._compObserver=null;}
  window._compMergedRows=[];window._compRendered=0;
  document.getElementById("compMatFocusBtn").className="btn";
  document.querySelectorAll("[data-cview]").forEach((b,i)=>b.className=i===0?"btn btn-active":"btn");
  document.querySelectorAll("[data-cfilt]").forEach((b,i)=>b.className=i===0?"btn btn-active":"btn");
  document.querySelectorAll("[data-csec]").forEach((b,i)=>b.className=i===0?"btn btn-sec-active":"btn");
  // Price history stays — just refresh dropdowns
  refreshAllDropdowns();
}
