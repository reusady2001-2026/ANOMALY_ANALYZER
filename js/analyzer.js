// ══════════════════════════════════════════════════════════════
// SECTION: Analyzer Engine (runAnalysis, renderAnalyzer, stats)
// ══════════════════════════════════════════════════════════════
var DATA=null,RESULTS=null,FILTER="all",SEC_FILTER="all",MAT_FOCUS=false;
var PLATFORM="operational"; // "operational" | "asset"
function runAnalysis(){if(!DATA)return;const pp=getP("ppInput");
  if(pp<=0){alert("Please enter a Purchase Price before running analysis.");return;}
  if(!document.getElementById("aiState").value){alert("Please select a State before running analysis.");return;}
  if(!document.getElementById("aiCity").value.trim()){alert("Please enter a City before running analysis.");return;}
  window._aiCache={};
  try{if(window._currentFileName){localStorage.removeItem('aiCacheBak_'+sessionId(window._currentFileName,'analyzer'));}}catch(e){}
  if(pp>0)savePriceToHistory(pp);document.getElementById("thresholdInfo").textContent=`10bps: $${fmt(Math.round((pp*0.001)/12))}/mo`;
  const[fi,ti]=getPeriodIndices("periodFrom","periodTo");
  const maxTo=DATA.months.length-SKIP-1;
  const isFullRange=(fi===0&&ti>=maxTo);
  const sliced=isFullRange?DATA:sliceData(DATA,fi,ti);
  const sk=isFullRange?SKIP:0;
  const engine=PLATFORM==="asset"?analyzeAsset:analyze;
  RESULTS=sliced.metrics.map(m=>engine(m.name,m.values,sliced.months,m.isIncome,pp,sk)).filter(Boolean);
  window._sliced=sliced;window._slicedSkip=sk;
  cachedContext=null;cachedContext=buildDataContext();
  renderAnalyzer();
  // Save session immediately (before reason engine)
  saveCurrentSession(window._currentFileName||"analysis");
  // Run reason engine in background
  runReasonEngineAsync(sliced.months);
}
function renderAnalyzer(){if(!RESULTS)return;const sliced=window._sliced||DATA;if(!sliced)return;
  ["analyzerFilters","rerunBtn","statsRow","legendRow","tableWrap","chatBar"].forEach(id=>document.getElementById(id).classList.remove("hidden"));
  const filtered=applyFilter(RESULTS,FILTER,SEC_FILTER);document.getElementById("statsRow").innerHTML=statsHTML(getStats(RESULTS));
  const months=sliced.months;const sk=window._slicedSkip||SKIP;let html=`<thead><tr><th class="metric-col">Metric</th><th class="type-col">Type</th>`;months.forEach((m,i)=>html+=`<th class="${i>=months.length-sk&&sk>0?"skip-col":""}" style="font-size:8px;">${m}</th>`);
  html+=`<th class="trend-col">Trend</th><th class="trend-col">12M</th><th class="trend-col">3M</th><th class="quarter-col">Str Q</th><th class="quarter-col">Wk Q</th></tr></thead><tbody>`;
  filtered.forEach((met,mi)=>{const lc=met.sec==="income"?"income-label":"expense-label";html+=`<tr onmouseenter="showTip(this,${mi})" onmouseleave="hideTip()"><td class="metric-cell ${lc}" title="${met.name}">${met.name}</td><td class="type-cell">${met.mt==="sporadic"?"SPR":"CNT"}</td>${renderCells(met,MAT_FOCUS)}<td class="trend-cell">${trendHTML(met.tr.all)}</td><td class="trend-cell">${trendHTML(met.tr.m12)}</td><td class="trend-cell">${trendHTML(met.tr.m3)}</td><td class="q-cell">${met.sq?met.sq.k:"—"}</td><td class="q-cell">${met.wq?met.wq.k:"—"}</td></tr>`;});
  html+=`</tbody>`;document.getElementById("mainTable").innerHTML=html;window._filt=filtered;window._data=sliced;}
