// ══════════════════════════════════════════════════════════════
// SECTION: Session Persistence (save, load, compress, D1 cloud)
// ══════════════════════════════════════════════════════════════

// Shared globals used across ai-engine.js and events.js
var chatHistory=[];
var cachedContext=null;
var reasonResults=null;
var compReasonResults={}; // key: propertyId -> reasonResults
var contextStatus="idle";

// Deterministic ID based on fileName+mode so Supabase can upsert the same row
function sessionId(fileName,mode){
  const s=PLATFORM+'\0'+mode+'\0'+fileName;
  let h=5381;
  for(let i=0;i<s.length;i++)h=((h<<5)+h)^s.charCodeAt(i);
  const a=(h>>>0).toString(16).padStart(8,'0');
  const b=((h*1664525+1013904223)>>>0).toString(16).padStart(8,'0');
  return `${a}-${b.slice(0,4)}-4${b.slice(4,7)}-8${a.slice(0,3)}-${b}${a.slice(0,4)}`;
}

// Compress payload to gzip bytes. writeVal streams the object graph into 256KB
// string buffers which are encoded and queued, then written to CompressionStream
// concurrently with reading to avoid back-pressure deadlock.
async function objToGzipBytes(obj){
  const enc=new TextEncoder();
  const cs=new CompressionStream('gzip');
  const w=cs.writable.getWriter();
  const CHUNK=262144;
  let buf="";
  const pending=[];
  function flush(){if(!buf.length)return;pending.push(enc.encode(buf));buf="";}
  function emit(s){buf+=s;if(buf.length>=CHUNK)flush();}
  function writeVal(val){
    if(val===null||val===undefined){emit('null');return;}
    if(typeof val==='number'||typeof val==='boolean'){emit(typeof val==='number'&&!isFinite(val)?'null':String(val));return;}
    if(typeof val==='string'){emit(JSON.stringify(val));return;}
    if(Array.isArray(val)){
      emit('[');
      for(let i=0;i<val.length;i++){if(i)emit(',');writeVal(val[i]);}
      emit(']');return;
    }
    emit('{');let f=true;
    for(const[k,v]of Object.entries(val)){
      if(v===undefined)continue;
      if(!f)emit(',');
      emit(JSON.stringify(k)+':');
      writeVal(v);
      f=false;
    }
    emit('}');
  }
  writeVal(obj);flush();
  const parts=[];const rd=cs.readable.getReader();
  await Promise.all([
    (async()=>{for(const chunk of pending)await w.write(chunk);await w.close();})(),
    (async()=>{for(;;){const{done,value}=await rd.read();if(done)break;parts.push(value);}})()
  ]);
  const tot=parts.reduce((s,c)=>s+c.length,0);
  const out=new Uint8Array(tot);let off=0;
  for(const c of parts){out.set(c,off);off+=c.length;}
  return out;
}
function u8ToB64(u8){
  const CHUNK=8192;const parts=[];
  for(let i=0;i<u8.length;i+=CHUNK)
    parts.push(String.fromCharCode.apply(null,u8.subarray(i,i+CHUNK)));
  return btoa(parts.join(''));
}
async function gunzipB64(b64){
  const bin=atob(b64);const u8=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)u8[i]=bin.charCodeAt(i);
  const ds=new DecompressionStream('gzip');
  const w=ds.writable.getWriter();w.write(u8);w.close();
  return JSON.parse(await new Response(ds.readable).text());
}
// Feed chunks one-at-a-time into the DecompressionStream to avoid allocating
// one giant concatenated base64 string (which OOMs on large sessions).
async function gunzipChunked(chunkRows){
  chunkRows.sort((a,b)=>a.chunkIdx-b.chunkIdx);
  const ds=new DecompressionStream('gzip');
  const writer=ds.writable.getWriter();
  for(const chunk of chunkRows){
    const bin=atob(chunk.chunkData);
    const u8=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++)u8[i]=bin.charCodeAt(i);
    await writer.write(u8);
  }
  await writer.close();
  return JSON.parse(await new Response(ds.readable).text());
}
async function _postToCloud(body){
  try{
    const r=await fetch('/api/sessions',{method:'POST',
      headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    if(!r.ok){const e=await r.text();console.error('Cloud push error',r.status,e);return false;}
    return true;
  }catch(e){console.warn('Cloud push failed:',e);return false;}
}
// Coalescing save queue with 2 s debounce. Rapid successive saves (e.g. from
// period filter changes) collapse into one network round-trip. The explicit
// Save button bypasses debounce by calling _pushSessionImpl directly.
let _pendingSession=null,_pushActive=false,_saveDebounceTimer=null;
function pushSessionToCloud(session){
  _pendingSession=session;
  clearTimeout(_saveDebounceTimer);
  _saveDebounceTimer=setTimeout(async()=>{
    if(_pushActive)return;
    _pushActive=true;
    while(_pendingSession){
      const s=_pendingSession;_pendingSession=null;
      await _pushSessionImpl(s);
    }
    _pushActive=false;
  },2000);
}
async function _pushSessionImpl(session){
  const t0=performance.now();
  const{results,reasonResults,aiCache,chatHistory,months,sliced,
        properties,compReasonResults,data,...meta}=session;
  const payload={results,reasonResults,aiCache,chatHistory,months,sliced,
                 properties,compReasonResults,data};

  let gzBytes;
  try{gzBytes=await objToGzipBytes(payload);}catch(e){console.error('[Save] compress failed:',e);return false;}
  const b64=u8ToB64(gzBytes);
  console.log('[Save] compressed:',(gzBytes.length/1024).toFixed(0)+'KB b64:',(b64.length/1024).toFixed(0)+'KB total:',(performance.now()-t0).toFixed(0)+'ms');

  // Split into ≤700KB chunks so each D1 row stays under the 1MB limit
  const MAX=700000;
  if(b64.length<=MAX){
    return await _postToCloud({...meta,_compressed:true,_payload:b64});
  }else{
    const chunks=[];
    for(let i=0;i<b64.length;i+=MAX)chunks.push(b64.slice(i,i+MAX));
    // Header row first (must exist before chunks are written)
    if(!await _postToCloud({...meta,_chunked:true,chunkCount:chunks.length}))return false;
    // Chunk rows are independent — send in parallel
    const results2=await Promise.all(chunks.map((chunkData,i)=>
      _postToCloud({id:meta.id+'@@'+i,_isChunk:true,sessionId:meta.id,chunkIdx:i,chunkData})
    ));
    return results2.every(Boolean);
  }
}
async function deleteSessionFromCloud(id){
  if(!id)return;
  try{await fetch('/api/sessions?id='+encodeURIComponent(id),{method:'DELETE'});}
  catch(e){console.warn('Cloud delete failed:',e);}
}

function saveCurrentSession(fileName){
  const sliced=window._sliced||DATA;
  if(!sliced||!RESULTS)return;
  const session={
    id:sessionId(fileName,'analyzer'),
    mode:'analyzer',
    platform:PLATFORM,
    fileName,
    savedAt:Date.now(),
    months:sliced.months,
    sliced:{months:sliced.months},
    slicedSkip:window._slicedSkip||0,
    monthCount:sliced.months.length,
    metricCount:RESULTS.length,
    state:document.getElementById("aiState")?.value||"",
    city:document.getElementById("aiCity")?.value||"",
    price:getP("ppInput"),
    propType:document.getElementById("aiPropType")?.value||"",
    data:DATA?{months:DATA.months,metrics:DATA.metrics}:null,
    results:RESULTS,
    reasonResults:window.reasonResults||null,
    chatHistory:chatHistory||[],
    aiCache:window._aiCache||{},
  };
  // Bypass debounce — explicit save button needs a real success/failure result.
  return _pushSessionImpl(session);
}

function saveCompSession(){
  const aligned=window._compAligned;if(!aligned||!aligned.length)return;
  const names=aligned.map(p=>document.getElementById(`compName_${p.id}`)?.value||p.label).join(" vs ");
  const session={
    id:sessionId(names,'comparison'),
    mode:'comparison',
    platform:PLATFORM,
    fileName:names,
    savedAt:Date.now(),
    monthCount:aligned[0]?.sliced?.months?.length||0,
    metricCount:aligned.reduce((c,p)=>c+(p.results?.length||0),0),
    properties:aligned.map(p=>({
      label:p.label,color:p.color,
      name:document.getElementById(`compName_${p.id}`)?.value||p.label,
      state:document.getElementById(`compState_${p.id}`)?.value||"",
      city:document.getElementById(`compCity_${p.id}`)?.value||"",
      price:getP(`compPP_${p.id}`),
      propType:document.getElementById(`compType_${p.id}`)?.value||"",
      results:p.results,
      data:p.data,
      sliced:p.sliced,
      alignedData:p.alignedData,
    })),
    compSkip:window._compSkip,
    reasonResults:window.reasonResults||null,
    compReasonResults:compReasonResults||{},
    chatHistory:chatHistory||[],
    aiCache:window._aiCache||{},
  };
  // Bypass debounce — explicit save button needs a real success/failure result.
  return _pushSessionImpl(session);
}

function restoreSession(session){
  if(session.mode==='comparison'){
    restoreCompSession(session);return;
  }
  DATA=session.data||null;RESULTS=session.results;
  window._sliced=session.sliced||(session.months?{months:session.months}:null);window._slicedSkip=session.slicedSkip||0;
  window.reasonResults=session.reasonResults||null;reasonResults=session.reasonResults||null;
  window._dataContext=session.dataContext||null;chatHistory=session.chatHistory||[];
  window._aiCache=session.aiCache||{};
  // Merge with localStorage backup in case cloud save was incomplete
  try{const _lk='aiCacheBak_'+sessionId(session.fileName||'','analyzer');const _bk=localStorage.getItem(_lk);if(_bk){Object.assign(window._aiCache,JSON.parse(_bk));}}catch(e){}
  console.log('[aiCache] restored keys:',Object.keys(window._aiCache).length,'(cloud:',Object.keys(session.aiCache||{}).length,')');
  cachedContext=null;cachedContext=buildDataContext();
  contextStatus=session.reasonResults?.lookup&&Object.keys(session.reasonResults.lookup).length>0?"done":"idle";
  document.getElementById("aiState").value=session.state||"";
  document.getElementById("aiCity").value=session.city||"";
  document.getElementById("ppInput").value=session.price?session.price.toLocaleString():"0";
  if(session.propType)document.getElementById("aiPropType").value=session.propType;
  document.getElementById("uploadBtn").textContent="✓ "+session.fileName;
  document.getElementById("thresholdInfo").textContent="10bps: $"+fmt(Math.round((session.price*0.001)/12))+"/mo";
  window._currentFileName=session.fileName;
  populatePeriod("periodFrom","periodTo",session.sliced?.months||session.months||[]);
  renderAnalyzer();
  // If no reasonResults saved, re-run the engine
  if(!reasonResults||!reasonResults.lookup||Object.keys(reasonResults.lookup).length===0){
    const months=session.sliced?.months||session.months||[];
    runReasonEngineAsync(months);
  }
  const msgs=document.getElementById("chatMessages");
  if(msgs&&chatHistory.length){msgs.innerHTML="";chatHistory.forEach(m=>{msgs.innerHTML+='<div class="chat-msg '+(m.role==="user"?"user":"ai")+'">'+m.content.replace(/\n/g,"<br>")+'</div>';});}
}

function restoreCompSession(session){
  console.log("[RestoreComp] Starting, properties:",session.properties?.length);
  chatHistory=session.chatHistory||[];
  window._aiCache=session.aiCache||{};
  // Merge with localStorage backup (for cross-device the cloud value is authoritative;
  // on same device the localStorage backup fills in anything the cloud may have lost)
  try{const _lk='aiCacheBak_'+sessionId(session.fileName||'','comparison');const _bk=localStorage.getItem(_lk);if(_bk){Object.assign(window._aiCache,JSON.parse(_bk));}}catch(e){}
  console.log('[aiCache] restored (comp) keys:',Object.keys(window._aiCache).length,'(cloud:',Object.keys(session.aiCache||{}).length,')');
  cachedContext=null;
  reasonResults=session.reasonResults||null;
  window.reasonResults=reasonResults;
  compReasonResults=session.compReasonResults||{};
  contextStatus=reasonResults&&reasonResults.lookup&&Object.keys(reasonResults.lookup).length>0?"done":"idle";
  // Rebuild comparison properties
  document.getElementById("compProperties").innerHTML="";
  compProperties=[];compPropertyCounter=0;
  session.properties.forEach((sp,i)=>{
    console.log("[RestoreComp] Adding property",i,sp.label,sp.name,"results:",sp.results?.length);
    const prop=addCompProperty();
    prop.data=sp.data;prop.results=sp.results;prop.sliced=sp.sliced;prop.alignedData=sp.alignedData;
    const card=document.getElementById(`compProp_${prop.id}`);
    if(card){
      const nameEl=document.getElementById(`compName_${prop.id}`);if(nameEl)nameEl.value=sp.name;
      const stEl=document.getElementById(`compState_${prop.id}`);if(stEl)stEl.value=sp.state;
      const ctEl=document.getElementById(`compCity_${prop.id}`);if(ctEl)ctEl.value=sp.city;
      const ppEl=document.getElementById(`compPP_${prop.id}`);if(ppEl)ppEl.value=sp.price?sp.price.toLocaleString():"0";
      const tpEl=document.getElementById(`compType_${prop.id}`);if(tpEl)tpEl.value=sp.propType;
      const btn=card.querySelector(".comp-prop-fields .btn");if(btn)btn.textContent="✓ "+sp.name;
    }else{console.error("[RestoreComp] Card not found for prop",prop.id);}
  });
  checkCompReady();
  // Rebuild aligned structure
  window._compAligned=session.properties.map((sp,i)=>{
    const cp=compProperties[i];
    if(!cp){console.error("[RestoreComp] compProperties["+i+"] missing");return null;}
    return{...cp,data:sp.data,results:sp.results,sliced:sp.sliced,alignedData:sp.alignedData};
  }).filter(Boolean);
  window._compSkip=session.compSkip;
  console.log("[RestoreComp] Aligned:",window._compAligned.length,"properties, skip:",window._compSkip);
  // Build combined RESULTS for chat context
  const allRes=[];session.properties.forEach(sp=>{if(sp.results)allRes.push(...sp.results);});
  RESULTS=allRes;cachedContext=buildDataContext();
  console.log("[RestoreComp] Calling renderComp, RESULTS:",RESULTS.length);
  renderComp();
  document.getElementById("chatBar").classList.remove("hidden");
  // If no reasonResults saved, re-run the engine
  if(!reasonResults||!reasonResults.lookup||Object.keys(reasonResults.lookup).length===0){
    console.log("[RestoreComp] No reasonResults, re-running engine");
    const aligned=window._compAligned;
    if(aligned&&aligned.length)runCompReasonEngines(aligned);
  }else{
    console.log("[RestoreComp] reasonResults loaded, keys:",Object.keys(reasonResults.lookup).length);
  }
  const msgs=document.getElementById("chatMessages");
  if(msgs&&chatHistory.length){msgs.innerHTML="";chatHistory.forEach(m=>{msgs.innerHTML+='<div class="chat-msg '+(m.role==="user"?"user":"ai")+'">'+m.content.replace(/\n/g,"<br>")+'</div>';});}
}

async function renderFileHistory(ddId, modeFilter){
  const dd=document.getElementById(ddId);
  dd.innerHTML='<div class="file-hist-sync">⟳ Loading...</div>';
  let allSessions=[];
  try{
    const r=await fetch('/api/sessions?platform='+encodeURIComponent(PLATFORM));
    if(r.ok){
      allSessions=await r.json();
    }else{
      const errText=await r.text().catch(()=>r.status);
      console.error('Session listing failed:',r.status,errText);
      dd.innerHTML='<div class="file-hist-empty" style="color:var(--red)">Error loading sessions ('+r.status+')</div>';
      return;
    }
  }catch(e){
    console.warn('Failed to load sessions:',e);
    dd.innerHTML='<div class="file-hist-empty" style="color:var(--red)">Connection error — check network</div>';
    return;
  }
  const sessions=allSessions.filter(s=>!modeFilter||s.mode===modeFilter);
  if(!sessions.length){dd.innerHTML='<div class="file-hist-empty">No recent '+(modeFilter==='comparison'?'comparisons':'analyses')+'</div>';return;}
  dd.innerHTML=sessions.map((s,i)=>{
    const d=new Date(s.savedAt);
    const dateStr=d.toLocaleDateString()+" "+d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
    const loc=s.mode==='comparison'?(s.properties||[]).map(p=>[p.city,p.state].filter(Boolean).join(", ")).filter(Boolean).join(" / "):[s.city,s.state].filter(Boolean).join(", ");
    const modeLabel=s.mode==='comparison'?'⚖️ ':'📊 ';
    return '<div class="file-hist-item" data-sidx="'+i+'" data-cloud-id="'+(s.id||'')+'"><div class="file-hist-name">'+modeLabel+s.fileName+'</div><div class="file-hist-meta">'+dateStr+' · '+s.monthCount+' months · '+s.metricCount+' metrics'+(loc?' · '+loc:'')+'</div><button class="file-hist-del" data-sidx="'+i+'" data-cloud-id="'+(s.id||'')+'" title="Delete session">\xd7</button></div>';
  }).join("");
  dd.querySelectorAll(".file-hist-item").forEach(item=>{
    item.addEventListener("click",async function(e){
      if(e.target.classList.contains("file-hist-del"))return;
      e.stopPropagation();
      const idx=parseInt(this.dataset.sidx);
      let session=sessions[idx];
      if(!session)return;
      dd.classList.add("hidden");
      if(session._chunked&&session.chunkCount){
        // Reassemble chunks then decompress
        try{
          const r=await fetch('/api/sessions?chunksFor='+encodeURIComponent(session._cloudId));
          const chunkRows=await r.json();
          const payload=await gunzipChunked(chunkRows);
          session={...session,...payload};
        }catch(err){console.error('Failed to load session chunks',err);}
      }else if(session._compressed){
        try{
          // Listing responses omit _payload for bandwidth; fetch the full record by id.
          let b64=session._payload;
          if(!b64&&session._cloudId){
            const r2=await fetch('/api/sessions?id='+encodeURIComponent(session._cloudId));
            if(r2.ok){const full=await r2.json();b64=full._payload;}
          }
          if(b64){const p=await gunzipB64(b64);session={...session,...p};}
        }catch(err){console.error('Failed to decompress session',err);}
      }
      if(session.mode==='comparison'){showMode("comp");restoreCompSession(session);}
      else{restoreSession(session);showMode("analyzer");}
    });
  });
  dd.querySelectorAll(".file-hist-del").forEach(btn=>{
    btn.addEventListener("click",function(e){
      e.stopPropagation();
      const cloudId=this.dataset.cloudId;
      if(cloudId)deleteSessionFromCloud(cloudId);
      renderFileHistory(ddId,modeFilter);
    });
  });
}

// Per-property history dropdown for comparison mode.
// Shows only ANALYZER sessions of the current platform.
// Clicking a session loads its data into the given property slot (prop object).
async function renderPropHistory(ddId,prop){
  const dd=document.getElementById(ddId);
  dd.innerHTML='<div class="file-hist-sync">⟳ Loading...</div>';
  let allSessions=[];
  try{
    const r=await fetch('/api/sessions?platform='+encodeURIComponent(PLATFORM));
    if(r.ok){
      allSessions=await r.json();
    }else{
      const errText=await r.text().catch(()=>r.status);
      console.error('Session listing failed:',r.status,errText);
      dd.innerHTML='<div class="file-hist-empty" style="color:var(--red)">Error loading sessions ('+r.status+')</div>';
      return;
    }
  }catch(e){
    console.warn('Failed to load sessions:',e);
    dd.innerHTML='<div class="file-hist-empty" style="color:var(--red)">Connection error — check network</div>';
    return;
  }
  const sessions=allSessions.filter(s=>
    s.mode==='analyzer'
  );
  if(!sessions.length){
    dd.innerHTML='<div class="file-hist-empty">No saved '+(PLATFORM==='asset'?'Asset Management':'Operational')+' analyses</div>';
    return;
  }
  dd.innerHTML=sessions.map((s,i)=>{
    const d=new Date(s.savedAt);
    const dateStr=d.toLocaleDateString()+" "+d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
    const loc=[s.city,s.state].filter(Boolean).join(", ");
    return '<div class="file-hist-item" data-sidx="'+i+'">'
      +'<div class="file-hist-name">📊 '+s.fileName+'</div>'
      +'<div class="file-hist-meta">'+dateStr+' · '+s.monthCount+' months'+(loc?' · '+loc:'')+'</div>'
      +'</div>';
  }).join("");
  dd.querySelectorAll(".file-hist-item").forEach(item=>{
    item.addEventListener("click",async function(e){
      e.stopPropagation();
      const idx=parseInt(this.dataset.sidx);
      let session=sessions[idx];if(!session)return;
      dd.classList.add("hidden");
      // Decompress if needed
      if(session._chunked&&session.chunkCount){
        try{
          const r=await fetch('/api/sessions?chunksFor='+encodeURIComponent(session._cloudId));
          const chunkRows=await r.json();
          const payload=await gunzipChunked(chunkRows);
          session={...session,...payload};
        }catch(err){console.error('Failed to load session chunks',err);}
      }else if(session._compressed){
        try{
          let b64=session._payload;
          if(!b64&&session._cloudId){
            const r2=await fetch('/api/sessions?id='+encodeURIComponent(session._cloudId));
            if(r2.ok){const full=await r2.json();b64=full._payload;}
          }
          if(b64){const p=await gunzipB64(b64);session={...session,...p};}
        }catch(err){console.error('Failed to decompress session',err);}
      }
      // Load into property slot
      // Re-resolve the live reference in case compProperties was mutated during the async fetch
      const liveProp=compProperties.find(p=>p.id===prop.id)||prop;
      // Build month list: prefer session.sliced, fall back to top-level session.months (present in
      // all saved sessions including legacy ones that predate the meta/payload split).
      const sessionMonths=session.sliced?.months||session.months||null;
      liveProp.data=session.data||(sessionMonths?{months:sessionMonths,metrics:[]}:null);
      liveProp.results=session.results||null;
      liveProp.sliced=session.sliced||(sessionMonths?{months:sessionMonths}:null);
      const nameEl=document.getElementById(`compName_${prop.id}`);if(nameEl)nameEl.value=session.fileName||'';
      const stEl=document.getElementById(`compState_${prop.id}`);if(stEl)stEl.value=session.state||'';
      const ctEl=document.getElementById(`compCity_${prop.id}`);if(ctEl)ctEl.value=session.city||'';
      const ppEl=document.getElementById(`compPP_${prop.id}`);if(ppEl)ppEl.value=session.price?session.price.toLocaleString():'0';
      const tpEl=document.getElementById(`compType_${prop.id}`);if(tpEl)tpEl.value=session.propType||'';
      const btn=document.querySelector(`#compProp_${prop.id} .comp-prop-fields .btn`);
      if(btn)btn.textContent='✓ '+session.fileName;
      checkCompReady();
    });
  });
}
