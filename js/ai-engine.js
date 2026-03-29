// ══════════════════════════════════════════════════════════════
// SECTION: AI & Reason Engine (context, rules, deep analysis)
// ══════════════════════════════════════════════════════════════

// Reason engine for comparison mode — runs for each property
async function runCompReasonEngines(aligned){
  console.log("[CompReasons] CALLED with",aligned.length,"properties");
  contextStatus="loading";updateContextIndicator();
  for(const p of aligned){
    if(!p.results){console.log("[CompReasons] Skipping",p.label,"— no results");continue;}
    console.log("[CompReasons] Processing",p.label,"with",p.results.length,"metrics");
    const st=document.getElementById(`compState_${p.id}`)?.value||"";
    const ct=document.getElementById(`compCity_${p.id}`)?.value||"";
    console.log("[CompReasons]",p.label,"state:",st,"city:",ct,"id:",p.id);
    const stAbbr=st?(Object.entries(Context.STATE_ABBR).find(([k])=>k===st)||[])[1]||"":"";
    const assetInfo={type:document.getElementById(`compType_${p.id}`)?.value||"Multifamily Residential",location:ct&&st?ct+", "+st:"",city:ct,state:st};
    const months=p.sliced?.months||p.alignedData?.months||[];
    console.log("[CompReasons]",p.label,"stateAbbr:",stAbbr,"months:",months.length);
    let dataContext={};
    if(stAbbr&&ct){
      try{dataContext=await Context.fetchDataContext(stAbbr,ct,months);console.log("[CompReasons]",p.label,"context fetched OK");}catch(e){console.warn("[CompReasons] Context fetch failed for",p.label,e);}
    }else{console.log("[CompReasons]",p.label,"skipping API — no state/city");}
    try{
      const rr=Adapter.runReasonEngine(p.results,months,assetInfo,dataContext);
      compReasonResults[p.id]=rr;
      console.log("[CompReasons]",p.label,"rules done, lookup keys:",Object.keys(rr.lookup||{}).length);
    }catch(e){console.error("[CompReasons] Rule engine CRASHED for",p.label,e);}
  }
  // Merge all reason results — prefix keys with property label to avoid collision
  reasonResults={lookup:{},results:[],clusters:[]};
  aligned.forEach(p=>{
    const rr=compReasonResults[p.id];
    if(!rr){console.log("[CompReasons] No results for",p.label);return;}
    console.log("[CompReasons] Merging",p.label,"lookup:",Object.keys(rr.lookup||{}).length);
    if(rr.lookup){
      Object.entries(rr.lookup).forEach(([key,val])=>{
        reasonResults.lookup[p.label+"|||"+key]=val;
        if(!reasonResults.lookup[key])reasonResults.lookup[key]=val;
      });
    }
    if(rr.results)reasonResults.results.push(...rr.results);
    if(rr.clusters)reasonResults.clusters.push(...rr.clusters);
  });
  window.reasonResults=reasonResults;
  console.log("[CompReasons] DONE. Total lookup keys:",Object.keys(reasonResults.lookup).length);
  contextStatus="done";updateContextIndicator();
  saveCompSession();
}

function buildDataContext(){
  if(cachedContext)return cachedContext;
  if(!RESULTS)return"";
  // In comparison mode, use aligned months. In analyzer mode, use sliced.
  const aligned=window._compAligned;
  let months;
  if(aligned&&aligned.length){
    months=aligned[0].sliced?aligned[0].sliced.months:aligned[0].alignedData?.months||[];
  }else{
    const sliced=window._sliced||DATA;
    months=sliced?sliced.months:[];
  }
  const lines=[];
  RESULTS.forEach(met=>{
    const vals=met.res.map((r,i)=>{
      let info=`${months[i]||"?"}:${Math.round(r.v)}`;
      if(r.st==="anom")info+=`[ANOMALY z=${r.z?.toFixed(2)} ${r.zm} ${r.at} ${r.mat?"MATERIAL":""}]`;
      if(r.st==="seas")info+=`[SEASONAL]`;if(r.st==="skip")info+=`[SKIP]`;if(r.st==="pre")info+=`[PRE-OPEN]`;
      return info;
    }).join(" | ");
    lines.push(`${met.name} (${met.mt}, ${met.sec}, threshold=${met.th.toFixed(2)}): ${vals} | Trend:${Math.round(met.tr.all)} 12M:${Math.round(met.tr.m12)} 3M:${Math.round(met.tr.m3)}`);
  });
  cachedContext=lines.join("\n");return cachedContext;
}

function getAIContext(){
  return{propertyName:document.getElementById("aiCity")?.value||"",propertyType:document.getElementById("aiPropType")?.value||"Multifamily Residential",
    location:(document.getElementById("aiCity")?.value||"")+(document.getElementById("aiState")?.value?", "+document.getElementById("aiState").value:""),
    city:document.getElementById("aiCity")?.value||"",state:document.getElementById("aiState")?.value||""};
}

async function runReasonEngineAsync(months){
  if(!RESULTS||!RESULTS.length)return;
  const stateVal=document.getElementById("aiState")?.value||"";
  const cityVal=document.getElementById("aiCity")?.value||"";
  const stateAbbr=stateVal?(Object.entries(Context.STATE_ABBR).find(([k])=>k===stateVal)||[])[1]||"":"";
  contextStatus="loading";updateContextIndicator();
  const assetInfo={type:document.getElementById("aiPropType")?.value||"Multifamily Residential",location:cityVal&&stateVal?cityVal+", "+stateVal:"",city:cityVal,state:stateVal};
  let dataContext={};
  if(stateAbbr&&cityVal){
    try{dataContext=await Context.fetchDataContext(stateAbbr,cityVal,months);window._dataContext=dataContext;}catch(e){console.warn("Context fetch failed:",e);}
  }
  try{
    reasonResults=Adapter.runReasonEngine(RESULTS,months,assetInfo,dataContext);
    window.reasonResults=reasonResults;
    contextStatus="done";
    saveCurrentSession(window._currentFileName||"analysis");
  }catch(err){console.error("Reason engine error:",err);contextStatus="error";}
  updateContextIndicator();
}

function updateContextIndicator(){
  let el=document.getElementById("contextStatus");
  if(!el){el=document.createElement("div");el.id="contextStatus";el.style.cssText="position:fixed;top:70px;right:20px;padding:8px 14px;border-radius:8px;font-size:11px;font-family:inherit;z-index:300;";document.body.appendChild(el);}
  if(contextStatus==="loading"){el.style.display="";el.style.background="#20203a";el.style.border="1px solid #3b1f7a";el.style.color="#a78bfa";el.innerHTML='<span class="spinner" style="display:inline-block;width:12px;height:12px;border:2px solid #3f3f46;border-top-color:#a78bfa;border-radius:50%;animation:spin 0.8s linear infinite;vertical-align:middle;margin-right:6px;"></span>Loading economic context...';}
  else if(contextStatus==="done"){el.style.background="#0c1524";el.style.border="1px solid #1e3a5f";el.style.color="#93c5fd";el.textContent="\u2713 Context loaded \u2014 explanations ready";setTimeout(()=>{el.style.display="none";},3000);}
  else if(contextStatus==="error"){el.style.background="#1c1020";el.style.border="1px solid #5f1e1e";el.style.color="#fca5a5";el.textContent="\u26a0 Context fetch failed";setTimeout(()=>{el.style.display="none";},5000);}
}

async function sendChat(question){
  if(!question.trim())return;
  const msgs=document.getElementById("chatMessages");
  msgs.innerHTML+='<div class="chat-msg user">'+question+'</div>';
  msgs.innerHTML+='<div class="chat-msg ai ai-loading" id="chatLoading">Thinking...</div>';
  msgs.scrollTop=msgs.scrollHeight;
  const ctx=getAIContext();
  try{
    const resp=await fetch("/api/analyze-reasons",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({mode:"chat",context:cachedContext||buildDataContext(),question,history:chatHistory.slice(-10),...ctx})});
    const el=document.getElementById("chatLoading");
    if(!resp.ok){el.textContent="Error: "+resp.status;el.classList.remove("ai-loading");return;}
    const data=await resp.json();const answer=data.answer||data.raw||JSON.stringify(data);
    el.id="";el.classList.remove("ai-loading");el.innerHTML=answer.replace(/\n/g,"<br>");
    chatHistory.push({role:"user",content:question});chatHistory.push({role:"assistant",content:answer});
    if(window._compAligned&&window._compAligned.length)saveCompSession();
    else if(window._currentFileName)saveCurrentSession(window._currentFileName);
  }catch(err){const el=document.getElementById("chatLoading");if(el){el.id="";el.classList.remove("ai-loading");el.textContent="Error: "+err.message;}}
  msgs.scrollTop=msgs.scrollHeight;
}

document.getElementById("chatSendBtn").addEventListener("click",()=>{const inp=document.getElementById("chatInput");sendChat(inp.value);inp.value="";});
document.getElementById("chatInput").addEventListener("keydown",e=>{if(e.key==="Enter"){sendChat(e.target.value);e.target.value="";}});

document.addEventListener("click",function(e){
  const popup=document.getElementById("anomPopup");
  if(!e.target.closest(".anom-popup")&&!e.target.closest(".data-cell")){popup.classList.add("hidden");return;}
  const cell=e.target.closest(".data-cell");if(!cell)return;
  const cls=cell.className;
  if(!cls.includes("cell-anom")&&!cls.includes("cell-mat-pos")&&!cls.includes("cell-mat-neg")&&!cls.includes("cell-seas"))return;
  const tr=cell.closest("tr");if(!tr)return;
  const cells=Array.from(tr.querySelectorAll("td"));const cellIdx=cells.indexOf(cell);
  const metricName=cells[0]?.textContent?.trim()||"?";

  // Determine if this is comparison or analyzer table
  const isComp=!!tr.closest("#compTable");
  let monthIdx,month,met,months;
  if(isComp){
    monthIdx=cellIdx-3; // metric, src, type, then months
    const aligned=window._compAligned;
    if(!aligned||!aligned.length)return;
    months=aligned[0].sliced?aligned[0].sliced.months:aligned[0].alignedData.months;
    month=months[monthIdx]||"?";
    // Find which property this row belongs to (via src badge color)
    const srcBadge=cells[1]?.querySelector(".src-badge");
    const propLabel=srcBadge?.textContent?.trim()||"";
    const prop=aligned.find(p=>p.label===propLabel);
    met=prop?.results?.find(r=>r.name===metricName);
  }else{
    monthIdx=cellIdx-2; // metric, type, then months
    const sliced=window._sliced||DATA;
    if(!sliced||!RESULTS)return;
    months=sliced.months;
    month=months[monthIdx]||"?";
    met=RESULTS.find(r=>r.name===metricName);
  }
  if(!met)return;
  const r=met.res[monthIdx];if(!r)return;
  const dir=r.at==="pos"?"Positive (good)":"Negative (bad)";
  const method=r.zm==="ch"?"Change (month-over-month)":"Value (deviation from mean)";
  const status=r.mat?"Material Anomaly":r.st==="seas"?"Seasonal":"Anomaly";
  // Build lookup key — for comparison, try prefixed key first, then plain
  let lookupKey=metricName+"|||"+monthIdx;
  let propLabelForKey="";
  if(isComp){
    const srcBadge2=cells[1]?.querySelector(".src-badge");
    propLabelForKey=srcBadge2?.textContent?.trim()||"";
    const prefixedKey=propLabelForKey+"|||"+metricName+"|||"+monthIdx;
    if(reasonResults?.lookup[prefixedKey])lookupKey=prefixedKey;
  }
  const hasReason=reasonResults&&reasonResults.lookup[lookupKey];
  let h='<div class="pop-header"><span>'+metricName+" \u2014 "+month+(propLabelForKey?" ("+propLabelForKey+")":"")+'</span><button class="pop-close" onclick="document.getElementById(\'anomPopup\').classList.add(\'hidden\')">\u2715</button></div>';
  h+='<div class="pop-row"><span>Value:</span><strong>$'+fmt(r.v)+'</strong></div>';
  h+='<div class="pop-row"><span>Z-Score:</span><strong>'+(r.z?.toFixed(3)||"\u2014")+'</strong></div>';
  h+='<div class="pop-row"><span>Threshold:</span><strong>'+met.th.toFixed(3)+'</strong></div>';
  h+='<div class="pop-row"><span>Method:</span><strong>'+method+'</strong></div>';
  h+='<div class="pop-row"><span>Direction:</span><strong>'+dir+'</strong></div>';
  h+='<div class="pop-row"><span>Status:</span><strong>'+status+'</strong></div>';
  if(r.chv!=null)h+='<div class="pop-row"><span>Change:</span><strong>$'+fmt(r.chv)+'</strong></div>';
  if(hasReason)h+='<button class="pop-explain-btn" data-metric="'+metricName+'" data-month="'+month+'" data-midx="'+monthIdx+'" data-lkey="'+lookupKey+'">\ud83d\udccb View Explanation</button>';
  else if(contextStatus==="loading")h+='<div style="margin-top:10px;font-size:10px;color:#71717a;text-align:center;">\u23f3 Loading context data...</div>';
  else h+='<div style="margin-top:10px;font-size:10px;color:#71717a;text-align:center;">No explanation available</div>';
  popup.innerHTML=h;popup.classList.remove("hidden");
  const rect=cell.getBoundingClientRect();
  popup.style.left=Math.min(rect.left,window.innerWidth-380)+"px";
  popup.style.top=Math.min(rect.bottom+8,window.innerHeight-300)+"px";
});

function renderReasonPanel(data){
  let h="";const conf=data.confidenceLabel||"low";const confPct=data.adjustedConfidence||0;
  if(data.enrichedPrimary){h+='<div class="ai-card"><div class="ai-card-header"><span class="ai-card-metric">Primary Reason</span><span class="ai-card-badge '+conf+'">'+conf+" ("+confPct+'%)</span></div><div class="ai-card-primary">'+data.enrichedPrimary.replace(/\n/g,"<br>")+"</div></div>";}
  else if(data.primary){h+='<div class="ai-card"><div class="ai-card-header"><span class="ai-card-metric">Primary Reason</span><span class="ai-card-badge '+conf+'">'+conf+'</span></div><div class="ai-card-primary">'+data.primary.label+"</div></div>";}
  const alts=data.enrichedAlternatives||data.alternatives||[];
  if(alts.length){h+='<div class="ai-card"><div class="ai-card-metric" style="margin-bottom:8px;font-size:11px;color:#a78bfa;">Alternatives</div><div class="ai-card-alts">';alts.forEach((a,i)=>{h+="<div><strong>"+(i+1)+".</strong> "+a+"</div>";});h+="</div></div>";}
  if(data.firedByTier){const tiers=[{key:"tier1",label:"Verified Facts (API Data)",color:"#16a34a"},{key:"tier2",label:"Metric-Specific Match",color:"#6366f1"},{key:"tier3",label:"Data Pattern",color:"#d97706"},{key:"tier4",label:"General Context",color:"#71717a"}];let tierH="";
    tiers.forEach(t=>{const rules=data.firedByTier[t.key];if(rules&&rules.length){tierH+='<div style="margin:4px 0;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:'+t.color+';margin-right:6px;"></span><span style="font-size:10px;color:'+t.color+';font-weight:700;">'+t.label+":</span>";rules.forEach(r=>{tierH+='<div style="font-size:10px;color:#a1a1aa;margin-left:18px;">\u2022 '+r+"</div>";});tierH+="</div>";}});
    if(tierH)h+='<div class="ai-card"><div class="ai-card-metric" style="margin-bottom:6px;font-size:11px;color:#a78bfa;">Fired Rules</div>'+tierH+"</div>";}
  if(data.confidenceNotes&&data.confidenceNotes.length){h+='<div class="ai-card"><div class="ai-card-metric" style="margin-bottom:6px;font-size:11px;color:#a78bfa;">Confidence Adjustments</div>';data.confidenceNotes.forEach(n=>{const col=n.delta>0?"#4ade80":"#f87171";h+='<div style="font-size:10px;color:'+col+';margin:2px 0;">'+(n.delta>0?"+":"")+n.delta+"% \u2014 "+n.text+"</div>";});h+="</div>";}
  if(data.corroboratingNote)h+='<div class="ai-card" style="border-color:#3b1f7a;"><div class="ai-card-primary" style="color:#c4b5fd;">\ud83d\udd17 '+data.corroboratingNote+"</div></div>";
  if(data.dataSources&&data.dataSources.length){h+='<div class="ai-card"><div class="ai-card-metric" style="margin-bottom:6px;font-size:11px;color:#a78bfa;">Data Sources</div>';data.dataSources.forEach(s=>{h+='<div style="font-size:9px;color:#71717a;margin:2px 0;display:flex;justify-content:space-between;"><span>'+s.label+'</span><span style="color:#a1a1aa;">'+s.value+' <span style="color:#52525b;">('+s.period+")</span></span></div>";});h+="</div>";}
  return h;
}

document.addEventListener("click",function(e){
  const btn=e.target.closest(".pop-explain-btn");if(!btn||btn.classList.contains("ai-deep-btn"))return;
  const metricName=btn.dataset.metric,month=btn.dataset.month,midx=parseInt(btn.dataset.midx);
  const lkey=btn.dataset.lkey||metricName+"|||"+midx;
  const data=reasonResults?.lookup[lkey];
  document.getElementById("anomPopup").classList.add("hidden");
  const panel=document.getElementById("sidePanel"),body=document.getElementById("sidePanelBody");
  panel.classList.remove("hidden");
  if(!data){body.innerHTML='<div class="ai-error">No explanation data available.</div>';return;}
  let html='<div style="margin-bottom:12px;font-size:13px;font-weight:700;color:#eeeef4;">'+metricName+" \u2014 "+month+"</div>"+renderReasonPanel(data);
  // Check if AI deep analysis was already done
  const aiCacheKey=metricName+"_"+month;
  const cachedAI=(window._aiCache||{})[aiCacheKey]||null;
  console.log('[aiCache] lookup key:',aiCacheKey,'found:',!!cachedAI,'cache size:',Object.keys(window._aiCache||{}).length);
  if(cachedAI){
    html+='<div style="margin-top:16px;border-top:1px solid #2a2a38;padding-top:12px;">';
    html+='<div style="font-size:11px;color:#a78bfa;font-weight:700;margin-bottom:8px;">\ud83e\udde0 AI Deep Analysis <span style="font-weight:400;font-size:9px;opacity:0.7;">(cached)</span></div>';
    if(cachedAI.primaryReason)html+='<div class="ai-card"><div class="ai-card-primary"><strong>'+(cachedAI.primaryReason.category||"")+":</strong> "+(cachedAI.primaryReason.explanation||"")+"</div></div>";
    if(cachedAI.alternatives?.length){html+='<div class="ai-card"><div class="ai-card-alts">';cachedAI.alternatives.forEach((a,i)=>{html+="<div><strong>"+(i+1)+". "+(a.category||"")+":</strong> "+(a.explanation||"")+"</div>";});html+="</div></div>";}
    if(cachedAI.localContext)html+='<div class="ai-card"><div class="ai-card-primary"><strong>Local Context:</strong> '+cachedAI.localContext+"</div></div>";
    if(cachedAI.recommendation)html+='<div class="ai-insight"><p><strong>Recommendation:</strong> '+cachedAI.recommendation+"</p></div>";
    if(cachedAI.raw)html+='<div class="ai-card"><div class="ai-card-primary">'+cachedAI.raw+"</div></div>";
    html+='</div>';
    html+='<div style="margin-top:8px;"><button class="pop-explain-btn ai-deep-btn" data-metric="'+metricName+'" data-month="'+month+'" data-midx="'+midx+'" style="background:#3f3f46;width:100%;margin-top:0;font-weight:400;">\ud83d\udd04 Re-analyze with AI <span style="font-size:9px;opacity:0.7;">(paid)</span></button></div>';
  }else{
    html+='<div style="margin-top:16px;border-top:1px solid #2a2a38;padding-top:12px;"><button class="pop-explain-btn ai-deep-btn" data-metric="'+metricName+'" data-month="'+month+'" data-midx="'+midx+'" style="background:#6d28d9;width:100%;margin-top:0;">\ud83e\udde0 Deep Analysis with AI <span style="font-weight:400;font-size:9px;opacity:0.7;">(paid)</span></button></div>';
  }
  html+='<div id="aiDeepResult"></div>';
  body.innerHTML=html;
});

document.addEventListener("click",function(e){
  const btn=e.target.closest(".ai-deep-btn");if(!btn)return;
  const metricName=btn.dataset.metric,month=btn.dataset.month,midx=parseInt(btn.dataset.midx);
  // Find metric in analyzer or comparison results
  let met=null;
  if(RESULTS)met=RESULTS.find(r=>r.name===metricName);
  if(!met&&window._compAligned){
    for(const p of window._compAligned){
      met=p.results?.find(r=>r.name===metricName);
      if(met)break;
    }
  }
  if(!met)return;
  const r=met.res[midx];if(!r)return;
  const container=document.getElementById("aiDeepResult");if(!container)return;
  container.innerHTML='<div class="ai-loading" style="margin-top:12px;"><span class="spinner"></span> Claude is analyzing...</div>';
  const ctx=getAIContext();const rd=reasonResults?.lookup[metricName+"|||"+midx];
  const anomaly={metric:metricName,month,value:r.v,zScore:r.z?.toFixed(3),method:r.zm,direction:r.at==="pos"?"positive":"negative",isMaterial:r.mat,isSeasonal:r.st==="seas",change:r.chv,threshold:met.th,metricType:met.mt,section:met.sec,ruleEnginePrimary:rd?.primary?.label||"",ruleEngineAlternatives:rd?.alternatives||[],enrichedContext:rd?.enrichedPrimary||""};
  fetch("/api/analyze-reasons",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({mode:"explain",context:cachedContext||buildDataContext(),anomaly,...ctx})})
  .then(resp=>{if(!resp.ok)throw new Error("API error "+resp.status);return resp.json();})
  .then(data=>{
    // Save to in-memory cache and auto-persist to Supabase via session
    const aiCacheKey=metricName+"_"+month;
    if(!window._aiCache)window._aiCache={};
    window._aiCache[aiCacheKey]=data;
    // Persist to localStorage as a durability backup (in case cloud save fails)
    try{const _isComp=window._compAligned&&window._compAligned.length;
      const _bkName=_isComp?window._compAligned.map(p=>document.getElementById('compName_'+p.id)?.value||p.label).join(' vs '):window._currentFileName;
      if(_bkName)localStorage.setItem('aiCacheBak_'+sessionId(_bkName,_isComp?'comparison':'analyzer'),JSON.stringify(window._aiCache));
    }catch(e){}
    console.log('[aiCache] saved key:',aiCacheKey,'total:',Object.keys(window._aiCache).length);
    if(window._compAligned&&window._compAligned.length)saveCompSession();
    else if(window._currentFileName)saveCurrentSession(window._currentFileName);
    let h='<div style="margin-top:12px;border-top:1px solid #3b1f7a;padding-top:12px;"><div style="font-size:11px;color:#a78bfa;font-weight:700;margin-bottom:8px;">\ud83e\udde0 AI Deep Analysis</div>';
    if(data.primaryReason)h+='<div class="ai-card"><div class="ai-card-primary"><strong>'+(data.primaryReason.category||"")+":</strong> "+(data.primaryReason.explanation||"")+"</div></div>";
    if(data.alternatives?.length){h+='<div class="ai-card"><div class="ai-card-alts">';data.alternatives.forEach((a,i)=>{h+="<div><strong>"+(i+1)+". "+(a.category||"")+":</strong> "+(a.explanation||"")+"</div>";});h+="</div></div>";}
    if(data.localContext)h+='<div class="ai-card"><div class="ai-card-primary"><strong>Local Context:</strong> '+data.localContext+"</div></div>";
    if(data.recommendation)h+='<div class="ai-insight"><p><strong>Recommendation:</strong> '+data.recommendation+"</p></div>";
    if(data.raw)h+='<div class="ai-card"><div class="ai-card-primary">'+data.raw+"</div></div>";
    h+="</div>";container.innerHTML=h;
  }).catch(err=>{container.innerHTML='<div class="ai-error" style="margin-top:12px;">Error: '+err.message+"</div>";});
});

// Flush aiCache to localStorage on tab close so pending cloud saves aren't lost
window.addEventListener('beforeunload',function(){
  if(!window._aiCache||!Object.keys(window._aiCache).length)return;
  try{
    const isComp=window._compAligned&&window._compAligned.length;
    const nm=isComp?window._compAligned.map(p=>document.getElementById('compName_'+p.id)?.value||p.label).join(' vs '):window._currentFileName;
    if(nm)localStorage.setItem('aiCacheBak_'+sessionId(nm,isComp?'comparison':'analyzer'),JSON.stringify(window._aiCache));
  }catch(e){}
});
