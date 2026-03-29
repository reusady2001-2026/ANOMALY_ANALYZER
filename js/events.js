// ══════════════════════════════════════════════════════════════
// SECTION: Event Handlers (buttons, dropdowns, mode switching)
// ══════════════════════════════════════════════════════════════
document.getElementById("modeOperational").addEventListener("click",()=>{PLATFORM="operational";showMode("select");});
document.getElementById("modeAssetMgmt").addEventListener("click",()=>{PLATFORM="asset";showMode("select");});
document.getElementById("modeAnalyzer").addEventListener("click",()=>showMode("analyzer"));
document.getElementById("modeComparison").addEventListener("click",()=>showMode("comp"));
document.getElementById("backBtn").addEventListener("click",()=>{
  if(!document.getElementById("modeSelect").classList.contains("hidden")){
    showMode("appSelect");
  }else{
    resetAll();showMode("select");
  }
});
document.getElementById("uploadBtn").addEventListener("click",()=>document.getElementById("fileInput").click());
document.getElementById("fileInput").addEventListener("change",async function(e){const f=e.target.files?.[0];if(!f)return;try{DATA=await readFile(f);document.getElementById("uploadBtn").textContent="✓ "+f.name;window._currentFileName=f.name;populatePeriod("periodFrom","periodTo",DATA.months);runAnalysis();}catch(ex){document.getElementById("errorBox").textContent=ex.message;document.getElementById("errorBox").style.display="";}});

// Analyzer file history dropdown — shows only analyzer sessions
document.getElementById("fileHistBtn").addEventListener("click",function(e){
  e.stopPropagation();closeAllDropdowns();
  const dd=document.getElementById("fileHistDropdown");
  renderFileHistory("fileHistDropdown","analyzer");
  dd.classList.toggle("hidden");
  if(!dd.classList.contains("hidden")){
    const rect=this.getBoundingClientRect();
    dd.style.top=(rect.bottom+4)+"px";dd.style.left=rect.left+"px";
  }
});

// Comparison file history dropdown — shows only comparison sessions
document.getElementById("compFileHistBtn").addEventListener("click",function(e){
  e.stopPropagation();closeAllDropdowns();
  const dd=document.getElementById("compFileHistDropdown");
  renderFileHistory("compFileHistDropdown","comparison");
  dd.classList.toggle("hidden");
  if(!dd.classList.contains("hidden")){
    const rect=this.getBoundingClientRect();
    dd.style.position="fixed";
    dd.style.top=(rect.bottom+4)+"px";dd.style.left=rect.left+"px";
  }
});
// Save session buttons
document.getElementById("saveSessionBtn").addEventListener("click",function(){
  if(!RESULTS){alert("Run analysis first");return;}
  saveCurrentSession(window._currentFileName||"analysis");
  this.textContent="✓ Saved!";this.style.background="var(--green)";this.style.color="#000";this.style.borderColor="var(--green)";
  setTimeout(()=>{this.textContent="💾 Save";this.style.background="";this.style.color="";this.style.borderColor="";},2000);
});
document.getElementById("compSaveSessionBtn").addEventListener("click",function(){
  if(!window._compAligned){alert("Run comparison first");return;}
  saveCompSession();
  this.textContent="✓ Saved!";this.style.background="var(--green)";this.style.color="#000";this.style.borderColor="var(--green)";
  setTimeout(()=>{this.textContent="💾 Save";this.style.background="";this.style.color="";this.style.borderColor="";},2000);
});
document.getElementById("rerunBtn").addEventListener("click",runAnalysis);
document.getElementById("periodFrom").addEventListener("change",runAnalysis);
document.getElementById("periodTo").addEventListener("change",runAnalysis);
formatPP(document.getElementById("ppInput"));
document.querySelectorAll("[data-filter]").forEach(b=>b.addEventListener("click",function(){FILTER=this.dataset.filter;document.querySelectorAll("[data-filter]").forEach(x=>x.className="btn");this.className="btn btn-active";renderAnalyzer();}));
document.querySelectorAll("[data-sec]").forEach(b=>b.addEventListener("click",function(){SEC_FILTER=this.dataset.sec;document.querySelectorAll("[data-sec]").forEach(x=>x.className="btn");this.className="btn btn-sec-active";renderAnalyzer();}));
document.getElementById("compRunBtn").addEventListener("click",runComp);
document.getElementById("compPeriodFrom").addEventListener("change",function(){if(window._compAligned)runComp();});
document.getElementById("compPeriodTo").addEventListener("change",function(){if(window._compAligned)runComp();});
// Dynamic property formatPP handled in addCompProperty()
document.querySelectorAll("[data-cview]").forEach(b=>b.addEventListener("click",function(){CVIEW=this.dataset.cview;document.querySelectorAll("[data-cview]").forEach(x=>x.className="btn");this.className="btn btn-active";renderComp();}));
document.querySelectorAll("[data-cfilt]").forEach(b=>b.addEventListener("click",function(){CFILT=this.dataset.cfilt;document.querySelectorAll("[data-cfilt]").forEach(x=>x.className="btn");this.className="btn btn-active";renderComp();}));
document.querySelectorAll("[data-csec]").forEach(b=>b.addEventListener("click",function(){CSEC=this.dataset.csec;document.querySelectorAll("[data-csec]").forEach(x=>x.className="btn");this.className="btn btn-sec-active";renderComp();}));
// Material Focus toggles
document.getElementById("matFocusBtn").addEventListener("click",function(){MAT_FOCUS=!MAT_FOCUS;this.className=MAT_FOCUS?"btn btn-focus-active":"btn";renderAnalyzer();});
document.getElementById("compMatFocusBtn").addEventListener("click",function(){COMP_MAT_FOCUS=!COMP_MAT_FOCUS;this.className=COMP_MAT_FOCUS?"btn btn-focus-active":"btn";renderComp();});
document.getElementById("themeDark").addEventListener("click",function(){document.body.classList.remove("light");this.className="btn btn-active";document.getElementById("themeLight").className="btn";});
document.getElementById("themeLight").addEventListener("click",function(){document.body.classList.add("light");this.className="btn btn-active";document.getElementById("themeDark").className="btn";});

// Export menus
document.getElementById("exportBtn").addEventListener("click",function(e){e.stopPropagation();closeAllDropdowns();document.getElementById("exportMenu").classList.toggle("open");});
document.getElementById("compExportBtn").addEventListener("click",function(e){e.stopPropagation();closeAllDropdowns();document.getElementById("compExportMenu").classList.toggle("open");});
document.querySelectorAll("[data-exp]").forEach(b=>b.addEventListener("click",function(){doAnalyzerExport(this.dataset.exp);closeAllDropdowns();}));
document.querySelectorAll("[data-cexp]").forEach(b=>b.addEventListener("click",function(){doCompExport(this.dataset.cexp);closeAllDropdowns();}));
document.querySelectorAll("[data-mt]").forEach(b=>b.addEventListener("click",function(){MT_FILTER=this.dataset.mt;document.querySelectorAll("[data-mt]").forEach(x=>x.className="btn");this.className="btn btn-active";renderAnalyzer();}));
document.querySelectorAll("[data-cmt]").forEach(b=>b.addEventListener("click",function(){COMP_MT_FILTER=this.dataset.cmt;document.querySelectorAll("[data-cmt]").forEach(x=>x.className="btn");this.className="btn btn-active";renderComp();}));
