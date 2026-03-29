// ══════════════════════════════════════════════════════════════
// SECTION: Constants & Utility Functions (format, math, parse)
// ══════════════════════════════════════════════════════════════
var SKIP=2,LIN=0.04,FLOOR_C=1.0,STOL=0.10;

// Price history (localStorage, max 10) — custom dropdown
function loadPriceHistory(){try{return JSON.parse(localStorage.getItem("ppHist")||"[]");}catch(e){return[];}}
function savePriceToHistory(val){if(!val||val===0)return;let h=loadPriceHistory();h=h.filter(v=>v!==val);h.unshift(val);if(h.length>10)h=h.slice(0,10);localStorage.setItem("ppHist",JSON.stringify(h));refreshAllDropdowns();}
function refreshAllDropdowns(){document.querySelectorAll(".pp-dropdown").forEach(el=>{const h=loadPriceHistory();if(!h.length){el.innerHTML=`<div class="pp-empty">No history yet</div>`;return;}el.innerHTML=h.map(v=>`<div class="pp-item" data-val="${v}">${v.toLocaleString()}</div>`).join("");});}
function closeAllDropdowns(){document.querySelectorAll(".pp-dropdown,.export-menu,.city-dropdown,.file-hist-dropdown").forEach(d=>{d.classList.add("hidden");d.classList.remove("open");});}
refreshAllDropdowns();

// City API
var cityCache={};
async function fetchCities(state){
  if(cityCache[state])return cityCache[state];
  try{
    const r=await fetch("https://countriesnow.space/api/v0.1/countries/state/cities",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({country:"United States",state:state})});
    const d=await r.json();
    const cities=(d.data||[]).sort();
    cityCache[state]=cities;
    return cities;
  }catch(e){return[];}
}

function setupCitySearch(inputId, dropdownId, stateSelectId){
  const inp=document.getElementById(inputId);
  const dd=document.getElementById(dropdownId);
  const stSel=document.getElementById(stateSelectId);
  if(!inp||!dd||!stSel)return;
  let cities=[];

  stSel.addEventListener("change",async function(){
    inp.value="";cities=[];
    if(!this.value){dd.classList.add("hidden");return;}
    dd.innerHTML=`<div class="city-loading">Loading cities...</div>`;
    dd.classList.remove("hidden");
    cities=await fetchCities(this.value);
    dd.classList.add("hidden");
  });

  inp.addEventListener("input",function(){
    const q=this.value.toLowerCase().trim();
    if(!q||!cities.length){dd.classList.add("hidden");return;}
    const matches=cities.filter(c=>c.toLowerCase().includes(q)).slice(0,15);
    if(!matches.length){dd.innerHTML=`<div class="city-loading">No matches</div>`;dd.classList.remove("hidden");return;}
    dd.innerHTML=matches.map(c=>`<div class="city-item">${c}</div>`).join("");
    dd.classList.remove("hidden");
  });

  inp.addEventListener("focus",function(){
    if(this.value&&cities.length){this.dispatchEvent(new Event("input"));}
  });

  dd.addEventListener("click",function(e){
    const item=e.target.closest(".city-item");
    if(item){inp.value=item.textContent;dd.classList.add("hidden");}
  });
}

// Setup analyzer city search
setupCitySearch("aiCity","cityDropdown","aiState");

// ============ DYNAMIC COMPARISON PROPERTIES ============
var PROP_COLORS=["#6366f1","#ea580c","#16a34a","#d97706","#ec4899","#06b6d4","#8b5cf6","#f43f5e"];
var compProperties=[];
var compPropertyCounter=0;

var STATES_HTML=`<option value="">Select state...</option><option>Alabama</option><option>Alaska</option><option>Arizona</option><option>Arkansas</option><option>California</option><option>Colorado</option><option>Connecticut</option><option>Delaware</option><option>Florida</option><option>Georgia</option><option>Hawaii</option><option>Idaho</option><option>Illinois</option><option>Indiana</option><option>Iowa</option><option>Kansas</option><option>Kentucky</option><option>Louisiana</option><option>Maine</option><option>Maryland</option><option>Massachusetts</option><option>Michigan</option><option>Minnesota</option><option>Mississippi</option><option>Missouri</option><option>Montana</option><option>Nebraska</option><option>Nevada</option><option>New Hampshire</option><option>New Jersey</option><option>New Mexico</option><option>New York</option><option>North Carolina</option><option>North Dakota</option><option>Ohio</option><option>Oklahoma</option><option>Oregon</option><option>Pennsylvania</option><option>Rhode Island</option><option>South Carolina</option><option>South Dakota</option><option>Tennessee</option><option>Texas</option><option>Utah</option><option>Vermont</option><option>Virginia</option><option>Washington</option><option>West Virginia</option><option>Wisconsin</option><option>Wyoming</option><option>Washington DC</option>`;

var PTYPE_HTML=`<option value="Multifamily Residential">Multifamily</option><option value="Commercial Office">Commercial</option><option value="Retail">Retail</option><option value="Industrial">Industrial</option><option value="Mixed Use">Mixed Use</option><option value="Land/Development">Land</option>`;

function addCompProperty(){
  const id=compPropertyCounter++;
  const color=PROP_COLORS[compProperties.length%PROP_COLORS.length];
  const label=String.fromCharCode(65+compProperties.length); // A, B, C...
  const card=document.createElement("div");
  card.className="comp-prop-card";
  card.id=`compProp_${id}`;
  card.innerHTML=`
    <div class="comp-prop-header">
      <h4 style="color:${color}">Property ${label}</h4>
      ${compProperties.length>=2?`<button class="comp-prop-remove" data-propid="${id}" title="Remove">✕</button>`:""}
    </div>
    <div class="comp-prop-fields">
      <div class="ctrl-group"><label>File *</label><input type="file" accept=".xlsx,.xls,.csv" id="compFile_${id}" style="display:none;"><button class="btn" onclick="document.getElementById('compFile_${id}').click()">Choose file</button></div>
      <div class="ctrl-group"><label>Name</label><input type="text" class="name-input" id="compName_${id}" placeholder="Property ${label}" value="Property ${label}" style="background:#1e1e28;border:1px solid #3f3f46;color:#d8d8e0;padding:7px 10px;border-radius:5px;font-size:11px;font-family:inherit;width:150px;"></div>
      <div class="ctrl-group"><label>Price ($) *</label><div class="pp-wrap"><input type="text" id="compPP_${id}" value="0" style="background:#1e1e28;border:1px solid #3f3f46;color:#ea580c;padding:7px 12px;border-radius:5px;font-size:12px;font-family:inherit;font-weight:700;width:140px;"><button class="pp-hist-btn" data-pp-target="compPP_${id}" title="Price history">▾</button><div class="pp-dropdown" id="compPP_${id}_dd"></div></div></div>
      <div class="ctrl-group"><label>State *</label><select id="compState_${id}" style="background:#1e1e28;border:1px solid #3f3f46;color:#d8d8e0;padding:7px 8px;border-radius:5px;font-size:11px;font-family:inherit;width:140px;">${STATES_HTML}</select></div>
      <div class="ctrl-group"><label>City *</label><div class="city-search-wrap"><input type="text" id="compCity_${id}" placeholder="Type to search..." autocomplete="off" style="background:#1e1e28;border:1px solid #3f3f46;color:#d8d8e0;padding:7px 10px;border-radius:5px;font-size:11px;font-family:inherit;width:160px;"><div class="city-dropdown hidden" id="compCityDD_${id}"></div></div></div>
      <div class="ctrl-group"><label>Type</label><select id="compType_${id}" style="background:#1e1e28;border:1px solid #3f3f46;color:#d8d8e0;padding:7px 8px;border-radius:5px;font-size:11px;font-family:inherit;">${PTYPE_HTML}</select></div>
    </div>`;

  document.getElementById("compProperties").appendChild(card);

  const prop={id,label,color,data:null,results:null};
  compProperties.push(prop);

  // Setup events
  formatPP(document.getElementById(`compPP_${id}`));
  setupCitySearch(`compCity_${id}`,`compCityDD_${id}`,`compState_${id}`);
  refreshAllDropdowns();

  document.getElementById(`compFile_${id}`).addEventListener("change",async function(e){
    const f=e.target.files?.[0];if(!f)return;
    try{
      prop.data=await readFile(f);
      this.previousElementSibling||document.querySelector(`#compProp_${id} .btn`);
      const btn=document.querySelector(`#compProp_${id} .comp-prop-fields .btn`);
      if(btn)btn.textContent="✓ "+f.name;
      checkCompReady();
    }catch(ex){document.getElementById("compError").textContent=ex.message;document.getElementById("compError").style.display="";}
  });

  // Remove button
  const rmBtn=card.querySelector(".comp-prop-remove");
  if(rmBtn){
    rmBtn.addEventListener("click",function(){
      const pid=parseInt(this.dataset.propid);
      compProperties=compProperties.filter(p=>p.id!==pid);
      document.getElementById(`compProp_${pid}`).remove();
      relabelCompProperties();
      checkCompReady();
    });
  }

  return prop;
}

function relabelCompProperties(){
  compProperties.forEach((p,i)=>{
    p.label=String.fromCharCode(65+i);
    p.color=PROP_COLORS[i%PROP_COLORS.length];
    const card=document.getElementById(`compProp_${p.id}`);
    if(card){const h4=card.querySelector("h4");if(h4){h4.textContent=`Property ${p.label}`;h4.style.color=p.color;}}
  });
}

function checkCompReady(){
  const allHaveData=compProperties.length>=2&&compProperties.every(p=>p.data);
  document.getElementById("compRunBtn").classList.toggle("hidden",!allHaveData);
}

// Initialize with 2 properties
addCompProperty();
addCompProperty();

document.getElementById("addPropertyBtn").addEventListener("click",()=>addCompProperty());

// Dropdown button clicks
document.addEventListener("click",function(e){
  const btn=e.target.closest(".pp-hist-btn");
  if(btn){e.stopPropagation();closeAllDropdowns();const tgt=btn.dataset.ppTarget;const dd=document.getElementById(tgt+"_dd");if(dd)dd.classList.toggle("open");return;}
  const item=e.target.closest(".pp-item");
  if(item){const val=parseInt(item.dataset.val);const wrap=item.closest(".pp-wrap");const input=wrap.querySelector("input[type=text]");if(input&&val){input.value=val.toLocaleString();}closeAllDropdowns();return;}
  const nitem=e.target.closest(".nm-item");
  if(nitem){const val=nitem.dataset.val;const wrap=nitem.closest(".pp-wrap");const input=wrap.querySelector("input[type=text]");if(input){input.value=val;}closeAllDropdowns();return;}
  // Don't close if clicking inside a file history dropdown — let its own handler work
  if(e.target.closest(".file-hist-dropdown"))return;
  closeAllDropdowns();
});


function mn(a){if(!a.length)return 0;return a.reduce((s,v)=>s+v,0)/a.length;}
function sdev(a){if(a.length<2)return 0;const m=mn(a);return Math.sqrt(a.reduce((s,v)=>s+(v-m)**2,0)/(a.length-1));}
function allZ(a){return a.every(v=>v===0);}
function fmt(n){if(n==null||isNaN(n))return"—";return Math.round(n).toLocaleString("en-US");}
function fz(z){if(z==null||isNaN(z))return"";return z.toFixed(2);}
function fPct(n){if(n==null||isNaN(n))return"—";return(n>=0?"+":"")+n.toFixed(1)+"%";}

function classify(v){const oi=v.findIndex(x=>x!==0);if(oi===-1)return{t:"skip",oi:-1};const zc=v.filter(x=>x===0).length;return(zc>v.length/2&&v.slice(oi+1).some(x=>x===0))?{t:"sporadic",oi}:{t:"continuous",oi};}
function normVol(v,oi){const a=v.slice(oi);if(a.length<2)return 0;const ch=[];for(let i=1;i<a.length;i++)ch.push(a[i]-a[i-1]);const s=sdev(ch),am=Math.abs(mn(a));return am===0?0:s/am;}
function thresh(t,cv,nv){if(t==="continuous")return Math.max(FLOOR_C,LIN*nv);const m=mn(cv),s=sdev(cv);return Math.max(s===0?Infinity:Math.abs(m)/s,LIN*nv);}

function analyze(name,allV,months,isInc,pp,skip){
  if(skip===undefined)skip=SKIP;
  const matTh=(pp*0.001)/12,ae=allV.length-skip,vals=allV.slice(0,ae);
  if(!vals.length||allZ(vals))return null;const cl=classify(vals);if(cl.t==="skip")return null;
  const{t:mt,oi}=cl,cv=mt==="continuous"?vals.slice(oi):vals,nv=normVol(vals,mt==="continuous"?oi:0),th=thresh(mt,cv,nv);
  const chs=[];if(mt==="continuous"){for(let i=oi;i<vals.length;i++)chs.push(i===oi?{i,ch:0}:{i,ch:vals[i]-vals[i-1]});}
  const sdCh=mt==="continuous"?sdev(chs.filter((_,ci)=>ci>0).map(c=>c.ch)):0;
  const res=[];
  for(let i=0;i<allV.length;i++){const v=allV[i];
    if(i>=ae){res.push({mi:i,v,z:null,st:"skip",at:null,mat:false,seas:false,recur:false,zm:null,chv:null});continue;}
    if(mt==="continuous"&&i<oi){res.push({mi:i,v,z:null,st:"pre",at:null,mat:false,seas:false,recur:false,zm:null,chv:null});continue;}
    let z=0,det=false,zm=null;
    if(mt==="continuous"){if(i===oi){z=0;zm="ch";}else{const ch=vals[i]-vals[i-1];z=sdCh===0?0:ch/sdCh;zm="ch";}if(Math.abs(z)>th)det=true;if(!det&&i>oi){const vv=vals.slice(oi,i+1),m=mn(vv),s=sdev(vv);if(s>0){const zv=(vals[i]-m)/s;if(Math.abs(zv)>th){z=zv;det=true;zm="val";}}}}
    else{const m=mn(cv),s=sdev(cv);z=s===0?0:(v-m)/s;zm="val";if(Math.abs(z)>th)det=true;}
    let at=null;if(det){if(isInc)at=z>0?"pos":"neg";else at=z>0?"neg":"pos";}
    res.push({mi:i,v,z,st:det?"anom":"norm",at,mat:false,seas:false,recur:false,zm,chv:mt==="continuous"&&i>oi?vals[i]-vals[i-1]:null});}
  for(let i=1;i<res.length;i++){const p=res[i-1],c=res[i];if(p.st==="anom"&&c.st==="anom"&&p.zm==="ch"&&c.zm==="ch"&&((p.z>0&&c.z<0)||(p.z<0&&c.z>0))){c.st="norm";c.at=null;}}
  for(let i=0;i<res.length;i++){const r=res[i];if(r.st!=="anom")continue;if(mt==="continuous"){if(r.zm==="ch"&&r.chv!==null)r.mat=Math.abs(r.chv)>=matTh;else if(r.zm==="val"){const av=vals.slice(oi,i+1);r.mat=Math.abs(r.v-mn(av))>=matTh;}}else r.mat=Math.abs(r.v-mn(cv))>=matTh;}
  const seasP=[];for(let i=0;i<res.length;i++){const r=res[i];if(!r.mat)continue;for(const ci of[i-12,i+12]){if(ci<0||ci>=res.length||ci<=i)continue;const o=res[ci];if(!o||!o.mat)continue;if(r.at!==o.at)continue;const rv=r.zm==="ch"?r.chv:r.v,ov=o.zm==="ch"?o.chv:o.v;if(rv==null||ov==null)continue;if(ov!==0&&Math.abs(rv/ov-1)<=STOL)seasP.push([i,ci]);}}
  for(const[a,b]of seasP){res[a].seas=true;res[a].mat=false;res[a].st="seas";res[b].seas=true;res[b].mat=false;res[b].st="seas";}
  const recP=[];for(let i=0;i<res.length;i++){const r=res[i];if(r.st==="skip"||r.st==="pre"||r.seas)continue;for(const ci of[i-12,i+12]){if(ci<0||ci>=res.length||ci<=i)continue;const o=res[ci];if(!o||o.st==="skip"||o.st==="pre"||o.seas)continue;let rv,ov;if(mt==="continuous"){rv=r.chv!=null?r.chv:r.v;ov=o.chv!=null?o.chv:o.v;}else{rv=r.v;ov=o.v;}if(rv==null||ov==null||rv===0&&ov===0||ov===0)continue;if((rv>0)!==(ov>0))continue;if(Math.abs(rv/ov-1)<=STOL)recP.push([i,ci]);}}
  for(const[a,b]of recP){res[a].recur=true;res[b].recur=true;}
  const tc=[],ts=mt==="continuous"?oi:0;for(let i=ts;i<ae;i++)tc.push(i===ts?0:vals[i]-vals[i-1]);
  const tAll=tc.reduce((a,b)=>a+b,0),t12=tc.slice(-12).reduce((a,b)=>a+b,0),t3=tc.slice(-3).reduce((a,b)=>a+b,0);
  const MS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const gq=mi=>{const s=months[mi];if(!s)return null;const p=s.split(" ");return`Q${Math.floor(MS.indexOf(p[0])/3)+1} ${p[1]}`;};
  const gqm=mi=>{const s=months[mi];if(!s)return-1;return(MS.indexOf(s.split(" ")[0])%3)+1;};
  const es=mt==="continuous"?oi:0;let fqs=es;const oiq=gqm(es);if(oiq!==1)fqs=es+(4-oiq);let lqe=ae-1;while(lqe>=0&&gqm(lqe)!==3)lqe--;
  const qs={};if(fqs>=0&&lqe>=fqs){for(let i=fqs;i<=lqe;i++){const k=gq(i);if(k){if(!qs[k])qs[k]=0;qs[k]+=vals[i];}}}
  const qe=Object.entries(qs);let sq=null,wq=null;if(qe.length){sq=qe.reduce((a,b)=>b[1]>a[1]?b:a);wq=qe.reduce((a,b)=>b[1]<a[1]?b:a);}
  return{name,mt,oi,th,nv,res,tr:{all:tAll,m12:t12,m3:t3},sq:sq?{k:sq[0]}:null,wq:wq?{k:wq[0]}:null,isInc,sec:isInc?"income":"expense"};
}

function parseSheet(wb){
  const ws=wb.Sheets[wb.SheetNames[0]],json=XLSX.utils.sheet_to_json(ws,{header:1,defval:0}),MS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  let mri=-1,months=[];
  for(let i=0;i<Math.min(15,json.length);i++){const r=json[i];if(!r)continue;const pm=r.slice(1).filter(v=>typeof v==="string"&&MS.some(m=>String(v).startsWith(m))&&/\d{4}/.test(String(v)));if(pm.length>=6){mri=i;months=r.slice(1).map(v=>String(v).trim()).filter(v=>MS.some(m=>v.startsWith(m))&&/\d{4}/.test(v));break;}}
  if(mri===-1)throw new Error("Could not find months header row.");
  const mainH=["INCOME","EXPENSES","NET OPERATING INCOME","MORTGAGE","DEPRECIATION","NET INCOME"];let sec=null;const metrics=[];
  for(let i=mri+1;i<json.length;i++){const r=json[i];if(!r||r[0]==null||String(r[0]).trim()==="")continue;const lb=String(r[0]).trim(),up=lb.toUpperCase();if(up==="INCOME"){sec="income";continue;}if(up==="EXPENSES"){sec="expense";continue;}if(up==="NET OPERATING INCOME"||up.includes("MORTGAGE")||up.includes("PARTNERSHIP")||up.includes("DEPRECIATION")||up.includes("NET INCOME")||up.startsWith("OPERATING")||up.startsWith("BEGINNING")||up.startsWith("ENDING")||up.startsWith("DIFFERENCE")||up.startsWith("CAPEX")||up.startsWith("CASH"))break;if(mainH.some(h=>up===h))continue;if(up.startsWith("TOTAL "))continue;if(lb===lb.trim()&&!String(r[0]).startsWith(" ")){const nr=json[i+1];if(nr&&nr[0]!=null&&String(nr[0]).startsWith(" "))continue;}const vals=[];for(let j=1;j<=months.length;j++){const v=r[j];vals.push(typeof v==="number"?v:parseFloat(String(v).replace(/[$,]/g,""))||0);}if(vals.length===months.length&&sec)metrics.push({name:lb.replace(/^\s+/,""),values:vals,isIncome:sec==="income",section:sec});}
  return{months,metrics};
}
function readFile(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=e=>{try{res(parseSheet(XLSX.read(new Uint8Array(e.target.result),{type:"array"})));}catch(ex){rej(ex);}};r.onerror=()=>rej(new Error("Read failed"));r.readAsArrayBuffer(file);});}

// SHARED UI
function cellClass(r,matFocus){if(!r)return"";if(PLATFORM==="asset"){if(r.mat&&r.st==="anom")return r.at==="pos"?"cell-mat-pos":"cell-mat-neg";return"";}if(r.st==="skip")return"cell-skip";if(r.st==="pre")return"cell-pre";if(matFocus){if(r.mat&&r.st==="anom")return r.at==="pos"?"cell-mat-pos":"cell-mat-neg";return"";}if(r.st==="seas")return"cell-seas";if(r.mat&&r.st==="anom")return r.at==="pos"?"cell-mat-pos":"cell-mat-neg";if(r.st==="anom")return"cell-anom";return"";}
function trendHTML(v){if(v>0)return`<span class="trend-up">▲ ${fmt(v)}</span>`;if(v<0)return`<span class="trend-down">▼ ${fmt(v)}</span>`;return`<span class="trend-flat">—</span>`;}
function getStats(R){let ta=0,mp=0,mn2=0,se=0,rc=0;R.forEach(r=>r.res.forEach(m=>{if(m.st==="anom")ta++;if(m.mat&&m.at==="pos")mp++;if(m.mat&&m.at==="neg")mn2++;if(m.st==="seas"||m.seas)se++;if(m.recur)rc++;}));return{ta,mp,mn:mn2,se,rc,tm:R.length};}
function statsHTML(s){return[{l:"Metrics",v:s.tm,c:"#6366f1"},{l:"Anomalies",v:s.ta,c:"#ea580c"},{l:"Material ↑",v:s.mp,c:"#16a34a"},{l:"Material ↓",v:s.mn,c:"#dc2626"},{l:"Seasonal",v:s.se,c:"#d97706"},{l:"🔄",v:s.rc,c:"#a78bfa"}].map(x=>`<div class="stat-card"><div class="label">${x.l}</div><div class="value" style="color:${x.c}">${x.v}</div></div>`).join("");}
function renderCells(met,matFocus){let h="";met.res.forEach(r=>{const cc=cellClass(r,matFocus),isAsset=PLATFORM==="asset",zL=(!isAsset&&!matFocus&&r.z!=null&&r.st!=="pre"&&r.st!=="skip"&&Math.abs(r.z)>0.01)?`<div class="z-sub">z:${fz(r.z)}</div>`:"",ri=(!isAsset&&!matFocus&&r.recur)?`<span class="recur-icon">🔄</span>`:"",tip=r.z!=null?(isAsset&&r.zm==="t3"?`ΔT3: $${fmt(r.chv)}`:`Z:${fz(r.z)} | ${r.zm||"—"}`):"";h+=`<td class="data-cell ${cc}" title="${tip}"><div>${fmt(r.v)}${ri}</div>${zL}</td>`;});return h;}
function formatPP(el){el.addEventListener("input",function(e){const raw=e.target.value.replace(/[^0-9]/g,"");e.target.value=raw?parseInt(raw).toLocaleString():"0";});}
function getP(id){return parseInt(document.getElementById(id).value.replace(/[^0-9]/g,""))||0;}
function applyFilter(R,filt,sec){let f=R;if(sec!=="all")f=f.filter(r=>r.sec===sec);if(filt==="anom")f=f.filter(r=>r.res.some(m=>m.st==="anom"||m.st==="seas"));if(filt==="mat")f=f.filter(r=>r.res.some(m=>m.mat||m.seas));if(filt==="seas")f=f.filter(r=>r.res.some(m=>m.seas||m.st==="seas"||m.recur));return f;}

// PERIOD FILTER
function getSelectableMonths(months){
  // Exclude last 2 months (iron rule)
  return months.slice(0, months.length - SKIP);
}
function populatePeriod(fromId, toId, months){
  const sel = getSelectableMonths(months);
  const fromEl=document.getElementById(fromId), toEl=document.getElementById(toId);
  fromEl.innerHTML=sel.map((m,i)=>`<option value="${i}"${i===0?" selected":""}>${m}</option>`).join("");
  toEl.innerHTML=sel.map((m,i)=>`<option value="${i}"${i===sel.length-1?" selected":""}>${m}</option>`).join("");
}
function sliceData(data, fromIdx, toIdx){
  const slicedMonths = data.months.slice(fromIdx, toIdx+1);
  const metrics = data.metrics.map(m=>({...m, values: m.values.slice(fromIdx, toIdx+1)}));
  return {months: slicedMonths, metrics};
}
function getPeriodIndices(fromId, toId){
  return [parseInt(document.getElementById(fromId).value)||0, parseInt(document.getElementById(toId).value)||0];
}

function showMode(m){
  document.getElementById("appSelect").classList.toggle("hidden",m!=="appSelect");
  document.getElementById("modeSelect").classList.toggle("hidden",m!=="select");
  document.getElementById("analyzerMode").classList.toggle("hidden",m!=="analyzer");
  document.getElementById("compMode").classList.toggle("hidden",m!=="comp");
  document.getElementById("backBtn").classList.toggle("hidden",m==="appSelect");
  const pfx=PLATFORM==="asset"?"Asset Management":"Operational";
  document.getElementById("headerSub").textContent=
    m==="analyzer"?pfx+" · Analyzer Mode":
    m==="comp"?pfx+" · Comparison Mode":
    m==="select"?pfx+" Analytics":
    "Select a platform to continue";
}
