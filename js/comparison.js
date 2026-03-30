// ══════════════════════════════════════════════════════════════
// SECTION: Comparison Mode (runComp, renderComp, alignMultiData)
// ══════════════════════════════════════════════════════════════
var CVIEW="all",CFILT="all",CSEC="all",COMP_MAT_FOCUS=false,COMP_MT_FILTER="all";

function alignMultiData(props){
  // Find common months across ALL properties
  let common=null;
  props.forEach(p=>{
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
  console.log('[RC1] runComp fired. compProperties:',compProperties.map(p=>({id:p.id,label:p.label,data:!!p.data,metricsLen:p.data?.metrics?.length??'null',results:p.results?.length??'null',sliced:!!p.sliced,slicedMonths:p.sliced?.months?.length??'null'})));
  const ready=compProperties.filter(p=>p.data||p.results);
  console.log('[RC2] ready props:',ready.length,'of',compProperties.length);
  if(ready.length<2){console.log('[RC2X] EXIT ready<2');return;}
  // Validate
  for(const p of compProperties){
    const pp=getP(`compPP_${p.id}`);
    const st=document.getElementById(`compState_${p.id}`)?.value;
    const ct=document.getElementById(`compCity_${p.id}`)?.value;
    console.log(`[RC3] prop ${p.label}: pp=${pp} st="${st}" ct="${ct}"`);
    if(pp<=0){console.log('[RC3X] EXIT pp<=0');alert(`Enter Purchase Price for Property ${p.label}`);return;}
    if(!st){console.log('[RC3X] EXIT no state');alert(`Select State for Property ${p.label}`);return;}
    if(!ct){console.log('[RC3X] EXIT no city');alert(`Enter City for Property ${p.label}`);return;}
    if(pp>0)savePriceToHistory(pp);
  }

  let aligned;
  // Reconstruct raw metrics from saved results for properties loaded via Analyzer session history.
  // p.data.metrics may be an empty stub when DATA was null at save time; p.results has the
  // full analysis. Rebuild metrics so alignMultiData has real months+values to work with.
  compProperties.forEach(p=>{
    const willReconstruct=p.data&&!p.data.metrics?.length&&p.sliced?.months&&p.results?.length;
    console.log(`[RC4] reconstruct ${p.label}: will=${willReconstruct} data=${!!p.data} metrics=${p.data?.metrics?.length??'null'} slicedMo=${p.sliced?.months?.length??'null'} results=${p.results?.length??'null'}`);
    if(willReconstruct){
      p.data.months=p.sliced.months;
      p.data.metrics=p.results.map(r=>({name:r.name,values:r.res.map(x=>x.v),isIncome:r.isInc,section:r.sec}));
      console.log('[RC4R] reconstructed',p.data.metrics.length,'metrics for',p.label);
    }
  });
  try{
    aligned=alignMultiData(compProperties);
    console.log('[RC5] alignMultiData OK — commonMonths:',aligned[0]?.alignedData?.months?.length,'metrics:',aligned.map(p=>p.alignedData?.metrics?.length));
  }catch(ex){
    console.log('[RC5X] alignMultiData THREW:',ex.message,ex.stack);
    document.getElementById("compError").textContent=ex.message;document.getElementById("compError").style.display="";return;
  }

  const commonMonths=aligned[0].alignedData.months;
  populatePeriod("compPeriodFrom","compPeriodTo",commonMonths);

  const[fi,ti]=getPeriodIndices("compPeriodFrom","compPeriodTo");
  const maxTo=commonMonths.length-SKIP-1;
  const isFullRange=(fi===0&&ti>=maxTo);
  const sk=isFullRange?SKIP:0;

  console.log('[RC6] fi=',fi,'ti=',ti,'maxTo=',maxTo,'isFullRange=',isFullRange,'sk=',sk);
  aligned.forEach(p=>{
    const sl=isFullRange?p.alignedData:sliceData(p.alignedData,fi,Math.min(ti,maxTo));
    p.sliced=sl;
    console.log(`[RC7] prop ${p.label}: sliced months=${sl?.months?.length} metrics=${sl?.metrics?.length}`);
    // Safety net: if metrics are still empty after reconstruction attempt but saved results
    // exist, keep the saved results rather than overwriting with [].
    const safetyNet=p.results&&p.results.length&&!p.data?.metrics?.length;
    console.log(`[RC7B] prop ${p.label}: safetyNet=${safetyNet} existingResults=${p.results?.length??'null'} dataMetrics=${p.data?.metrics?.length??'null'}`);
    if(safetyNet){console.log('[RC7B] keeping saved results for',p.label);return;}
    const pp=getP(`compPP_${p.id}`);
    const engine=PLATFORM==="asset"?analyzeAsset:analyze;
    p.results=sl.metrics.map(m=>engine(m.name,m.values,sl.months,m.isIncome,pp,sk)).filter(Boolean);
    console.log(`[RC7C] re-analyzed ${p.label}: ${p.results.length} results`);
  });

  window._compAligned=aligned;window._compSkip=sk;
  console.log('[RC8] calling renderComp()');
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
  const aligned=window._compAligned;
  console.log('[RCR] renderComp — aligned:',aligned?.length,'first sliced months:',aligned?.[0]?.sliced?.months?.length,'first results:',aligned?.[0]?.results?.length);
  if(!aligned||!aligned.length){console.log('[RCRX] EXIT no aligned');return;}
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
  let html=`<thead><tr><th class="metric-col">Metric</th><th class="src-col">Src</th><th class="type-col">Type</th>`;
  months.forEach((m,i)=>html+=`<th class="${i>=months.length-csk&&csk>0?"skip-col":""}" style="font-size:8px;">${m}</th>`);
  html+=`<th class="trend-col">Trend</th><th class="trend-col">12M</th><th class="trend-col">3M</th><th class="quarter-col">Str Q</th><th class="quarter-col">Wk Q</th></tr></thead><tbody>`;

  merged.forEach(m=>{
    const propIds=aligned.filter(p=>m.entries[p.id]).map(p=>p);
    propIds.forEach(p=>{
      const r=m.entries[p.id];
      if(!r)return;
      if(CVIEW!=="all"&&CVIEW!==p.label.toLowerCase())return;
      const lc=r.sec==="income"?"income-label":"expense-label";
      html+=`<tr style="background:${p.color}11;"><td class="metric-cell ${lc}" style="background:${p.color}18;">${r.name}</td><td class="type-cell"><span class="src-badge" style="background:${p.color}">${p.label}</span></td><td class="type-cell">${r.mt==="sporadic"?"SPR":"CNT"}</td>${renderCells(r,COMP_MAT_FOCUS)}<td class="trend-cell">${trendHTML(r.tr.all)}</td><td class="trend-cell">${trendHTML(r.tr.m12)}</td><td class="trend-cell">${trendHTML(r.tr.m3)}</td><td class="q-cell">${r.sq?r.sq.k:"—"}</td><td class="q-cell">${r.wq?r.wq.k:"—"}</td></tr>`;
    });

    // Delta row: show % difference between first two properties
    if(propIds.length>=2&&CVIEW==="all"){
      const rA=m.entries[propIds[0].id];
      const rB=m.entries[propIds[1].id];
      if(rA&&rB){
        let deltaH=`<tr class="row-delta" style="background:rgba(139,92,246,0.06);"><td class="metric-cell" style="color:var(--purple);font-style:italic;font-size:9px;background:rgba(139,92,246,0.08);">Δ%</td><td class="type-cell"></td><td class="type-cell"></td>`;
        const activeMonths=[];
        for(let i=0;i<months.length;i++){
          const skip=i>=months.length-csk&&csk>0;
          if(!skip)activeMonths.push(i);
        }
        // Compute deltas
        const deltas=[];
        for(let i=0;i<months.length;i++){
          const vA=rA.res[i]?.v;
          const vB=rB.res[i]?.v;
          const skip=i>=months.length-csk&&csk>0;
          if(skip||vA==null||vB==null){deltas.push(null);continue;}
          if(vB===0&&vA===0){deltas.push(0);continue;}
          if(vB===0){deltas.push(null);continue;}
          deltas.push(((vA-vB)/Math.abs(vB))*100);
        }
        // Stats for outlier detection
        const validDeltas=deltas.filter(d=>d!==null);
        const dMean=validDeltas.length?validDeltas.reduce((a,b)=>a+b,0)/validDeltas.length:0;
        const dSD=validDeltas.length>1?Math.sqrt(validDeltas.reduce((a,v)=>a+(v-dMean)**2,0)/validDeltas.length):0;

        for(let i=0;i<months.length;i++){
          const skip=i>=months.length-csk&&csk>0;
          const d=deltas[i];
          if(skip){deltaH+=`<td class="delta-cell cell-skip">—</td>`;continue;}
          if(d===null){deltaH+=`<td class="delta-cell">—</td>`;continue;}
          const isOutlier=dSD>0&&Math.abs((d-dMean)/dSD)>1.5;
          const col=d>0?"var(--green)":d<0?"var(--red)":"var(--text-muted)";
          deltaH+=`<td class="delta-cell${isOutlier?" delta-outlier":""}" style="color:${col}">${d>=0?"+":""}${d.toFixed(1)}%</td>`;
        }
        deltaH+=`<td class="delta-cell"></td><td class="delta-cell"></td><td class="delta-cell"></td><td class="delta-cell"></td><td class="delta-cell"></td></tr>`;
        html+=deltaH;
      }
    }
  });

  html+=`</tbody>`;document.getElementById("compTable").innerHTML=html;
}

function showTip(el,idx){const met=window._filt?.[idx];if(!met||!window._data)return;const d=window._data,t=document.getElementById("tooltip");t.className="tooltip-bar visible";t.innerHTML=`<span><strong>${met.name}</strong></span><span>Type: <strong>${met.mt}</strong></span><span>Threshold: <strong>${met.th.toFixed(2)}</strong></span><span>Norm.Vol: <strong>${met.nv.toFixed(2)}</strong></span><span>Opening: <strong>${d.months[met.oi]||"—"}</strong></span>`;}
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
  document.getElementById("compMatFocusBtn").className="btn";
  document.querySelectorAll("[data-cview]").forEach((b,i)=>b.className=i===0?"btn btn-active":"btn");
  document.querySelectorAll("[data-cfilt]").forEach((b,i)=>b.className=i===0?"btn btn-active":"btn");
  document.querySelectorAll("[data-csec]").forEach((b,i)=>b.className=i===0?"btn btn-sec-active":"btn");
  // Price history stays — just refresh dropdowns
  refreshAllDropdowns();
}
