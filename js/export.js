// ══════════════════════════════════════════════════════════════
// SECTION: Export (Excel, HTML — buildStyledTable, doExport)
// ══════════════════════════════════════════════════════════════
function getCellColor(r, mf){
  if(!r)return null;
  if(r.st==="skip"||r.st==="pre")return{bg:"#D9D9D9",fg:"#999999"};
  if(mf){if(r.mat&&r.st==="anom")return r.at==="pos"?{bg:"#15803D",fg:"#FFFFFF"}:{bg:"#B91C1C",fg:"#FFFFFF"};return null;}
  if(r.st==="seas")return{bg:"#B45309",fg:"#FFFFFF"};
  if(r.mat&&r.st==="anom")return r.at==="pos"?{bg:"#15803D",fg:"#FFFFFF"}:{bg:"#B91C1C",fg:"#FFFFFF"};
  if(r.st==="anom")return{bg:"#FFF3E0",fg:"#E65100"};
  return null;
}

function buildStyledTable(results, months, mf, stats, title){
  let h=`<table border="1" cellpadding="4" cellspacing="0" style="border-collapse:collapse;font-family:Arial;font-size:10px;">`;
  // Dashboard rows
  if(stats){
    h+=`<tr><td colspan="${months.length+7}" style="font-size:14px;font-weight:bold;background:#20203a;color:#ffffff;padding:12px;">${title||"Anomaly Report"}</td></tr>`;
    h+=`<tr>`;
    const cards=[
      {l:"Metrics",v:stats.tm,c:"#6366f1"},{l:"Anomalies",v:stats.ta,c:"#ea580c"},
      {l:"Material ↑",v:stats.mp,c:"#16a34a"},{l:"Material ↓",v:stats.mn,c:"#dc2626"},
      {l:"Seasonal",v:stats.se,c:"#d97706"},{l:"Recurring",v:stats.rc,c:"#a78bfa"}
    ];
    cards.forEach(c=>{h+=`<td style="background:#edeae6;padding:8px;text-align:center;"><div style="font-size:9px;color:#888;">${c.l}</div><div style="font-size:18px;font-weight:800;color:${c.c};">${c.v}</div></td>`;});
    for(let i=cards.length;i<months.length+7;i++)h+=`<td style="background:#edeae6;"></td>`;
    h+=`</tr><tr><td colspan="${months.length+7}"></td></tr>`;
  }
  // Header
  h+=`<tr style="background:#1a1a24;">`;
  h+=`<td style="font-weight:bold;color:#a1a1aa;min-width:200px;padding:6px;">Metric</td>`;
  h+=`<td style="font-weight:bold;color:#a1a1aa;text-align:center;padding:6px;">Type</td>`;
  months.forEach(m=>h+=`<td style="font-weight:bold;color:#a1a1aa;text-align:center;padding:6px;font-size:9px;">${m}</td>`);
  h+=`<td style="font-weight:bold;color:#a1a1aa;text-align:center;background:#1a0a2e;">Trend</td>`;
  h+=`<td style="font-weight:bold;color:#a1a1aa;text-align:center;background:#1a0a2e;">12M</td>`;
  h+=`<td style="font-weight:bold;color:#a1a1aa;text-align:center;background:#1a0a2e;">3M</td>`;
  h+=`<td style="font-weight:bold;color:#a1a1aa;text-align:center;background:#0c1524;">Str Q</td>`;
  h+=`<td style="font-weight:bold;color:#a1a1aa;text-align:center;background:#0c1524;">Wk Q</td>`;
  h+=`</tr>`;
  // Data rows
  results.forEach(met=>{
    const lc=met.sec==="income"?"#4ade80":"#f87171";
    h+=`<tr>`;
    h+=`<td style="font-weight:600;color:${lc};padding:4px 6px;">${met.name}</td>`;
    h+=`<td style="text-align:center;color:#888;font-size:9px;">${met.mt==="sporadic"?"SPR":"CNT"}</td>`;
    met.res.forEach(r=>{
      const col=getCellColor(r,mf);
      let sty="text-align:right;padding:4px 6px;";
      if(col){sty+=`background:${col.bg};color:${col.fg};font-weight:700;`;}
      const ri=(!mf&&r.recur)?" 🔄":"";
      h+=`<td style="${sty}">${fmt(r.v)}${ri}</td>`;
    });
    const tc=v=>v>0?"#16a34a":v<0?"#dc2626":"#888";
    const ta=v=>v>0?"▲ ":"▼ ";
    h+=`<td style="text-align:center;color:${tc(met.tr.all)};">${met.tr.all!==0?ta(met.tr.all):""}${fmt(met.tr.all)}</td>`;
    h+=`<td style="text-align:center;color:${tc(met.tr.m12)};">${met.tr.m12!==0?ta(met.tr.m12):""}${fmt(met.tr.m12)}</td>`;
    h+=`<td style="text-align:center;color:${tc(met.tr.m3)};">${met.tr.m3!==0?ta(met.tr.m3):""}${fmt(met.tr.m3)}</td>`;
    h+=`<td style="text-align:center;font-size:9px;">${met.sq?met.sq.k:"—"}</td>`;
    h+=`<td style="text-align:center;font-size:9px;">${met.wq?met.wq.k:"—"}</td>`;
    h+=`</tr>`;
  });
  h+=`</table>`;
  return h;
}

function downloadAsExcel(htmlTable, filename){
  const blob=new Blob([`<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="UTF-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Report</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body>${htmlTable}</body></html>`],{type:"application/vnd.ms-excel"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=filename;a.click();URL.revokeObjectURL(a.href);
}

function exportHTML(tableId, statsId, legendId, filename){
  const table=document.getElementById(tableId);
  const stats=document.getElementById(statsId);
  const legend=document.getElementById(legendId);
  const isLight=document.body.classList.contains("light");
  let html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Anomaly Report</title>
<style>body{font-family:'SF Mono',monospace;background:${isLight?"#f8f8fa":"#09090b"};color:${isLight?"#1a1a1a":"#d4d4d8"};padding:20px;}
table{border-collapse:collapse;font-size:10px;width:100%;}
th{padding:7px 5px;text-align:center;background:${isLight?"#f0f0f3":"#111113"};color:${isLight?"#555":"#71717a"};font-weight:700;font-size:9px;border-bottom:1px solid ${isLight?"#ddd":"#1e3050"};white-space:nowrap;}
td{padding:4px 5px;border-bottom:1px solid ${isLight?"#e8e8ea":"#1c1c1f"};white-space:nowrap;}
.cell-skip{background:${isLight?"#eee":"#1a1a20"};color:${isLight?"#aaa":"#555"};}
.cell-seas{background:#b45309;color:#fff;font-weight:700;}
.cell-mat-pos{background:#15803d;color:#fff;font-weight:700;}
.cell-mat-neg{background:#b91c1c;color:#fff;font-weight:700;}
.cell-anom{outline:2px solid #ea580c;outline-offset:-2px;font-weight:600;}
.stat-card{display:inline-block;background:${isLight?"#fff":"#18181b"};border:1px solid ${isLight?"#e0e0e0":"#1e3050"};border-radius:6px;padding:10px 18px;margin:4px;}
.stat-card .label{font-size:9px;color:${isLight?"#888":"#52525b"};text-transform:uppercase;}
.stat-card .value{font-size:22px;font-weight:800;}
.trend-up{color:${isLight?"#16a34a":"#4ade80"};}.trend-down{color:${isLight?"#dc2626":"#f87171"};}
.income-label{color:${isLight?"#15803d":"#4ade80"};}.expense-label{color:${isLight?"#dc2626":"#f87171"};}
.row-a{background:rgba(99,102,241,0.05);}.row-b{background:rgba(234,88,12,0.05);}
.delta-outlier{outline:2px solid #8b5cf6;outline-offset:-2px;}
.legend{padding:8px 0;display:flex;gap:14px;flex-wrap:wrap;font-size:10px;color:#71717a;}
</style></head><body><h2 style="margin-bottom:16px;">Operational Anomaly Report</h2>`;
  if(stats)html+=`<div style="margin-bottom:16px;">${stats.innerHTML}</div>`;
  if(legend)html+=`<div class="legend">${legend.innerHTML}</div>`;
  if(table)html+=table.outerHTML;
  html+=`</body></html>`;
  const blob=new Blob([html],{type:"text/html"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=filename;a.click();URL.revokeObjectURL(a.href);
}

function doAnalyzerExport(type){
  const isFiltered=type.includes("filtered");
  const isXlsx=type.includes("xlsx");
  const sliced=window._sliced||DATA;
  const mf=MAT_FOCUS;
  if(isXlsx){
    const data=isFiltered?applyFilter(RESULTS,FILTER,SEC_FILTER):RESULTS;
    const st=getStats(data);
    const tbl=buildStyledTable(data, sliced.months, mf, st, "Anomaly Report");
    downloadAsExcel(tbl,"anomaly_report.xls");
  }else{
    if(!isFiltered){const oldF=FILTER,oldS=SEC_FILTER;FILTER="all";SEC_FILTER="all";renderAnalyzer();exportHTML("mainTable","statsRow","legendRow","anomaly_report.html");FILTER=oldF;SEC_FILTER=oldS;renderAnalyzer();}
    else exportHTML("mainTable","statsRow","legendRow","anomaly_report.html");
  }
}

function doCompExport(type){
  const isFiltered=type.includes("filtered");
  const isXlsx=type.includes("xlsx");
  const nA="A",nB="B";
  if(isXlsx){
    // Build combined HTML table for both properties
    const dataA=window._compAligned?window._compAligned[0]?.results||[]:[];
    const dataB=window._compAligned&&window._compAligned[1]?window._compAligned[1].results||[]:[];
    const sliced=window._compSliced;
    const months=sliced?sliced.months:(window._compAligned?window._compAligned[0].alignedData.months:[]);
    const stA=getStats(dataA),stB=getStats(dataB);
    let tbl=`<table border="1" cellpadding="4" cellspacing="0" style="border-collapse:collapse;font-family:Arial;font-size:10px;">`;
    tbl+=`<tr><td colspan="${months.length+8}" style="font-size:14px;font-weight:bold;background:#20203a;color:#ffffff;padding:12px;">Comparison Report: ${nA} vs ${nB}</td></tr>`;
    // Stats for A
    tbl+=`<tr><td colspan="${months.length+8}" style="font-weight:bold;background:#4f46e5;color:#fff;padding:6px;">Property A: ${nA}</td></tr><tr>`;
    [{l:"Metrics",v:stA.tm,c:"#6366f1"},{l:"Anomalies",v:stA.ta,c:"#ea580c"},{l:"Mat ↑",v:stA.mp,c:"#16a34a"},{l:"Mat ↓",v:stA.mn,c:"#dc2626"},{l:"Seasonal",v:stA.se,c:"#d97706"},{l:"Recurring",v:stA.rc,c:"#a78bfa"}].forEach(c=>{tbl+=`<td style="background:#edeae6;padding:6px;text-align:center;"><div style="font-size:8px;color:#888;">${c.l}</div><div style="font-size:16px;font-weight:800;color:${c.c};">${c.v}</div></td>`;});
    for(let i=6;i<months.length+8;i++)tbl+=`<td style="background:#edeae6;"></td>`;
    tbl+=`</tr>`;
    // Stats for B
    tbl+=`<tr><td colspan="${months.length+8}" style="font-weight:bold;background:#ea580c;color:#fff;padding:6px;">Property B: ${nB}</td></tr><tr>`;
    [{l:"Metrics",v:stB.tm,c:"#6366f1"},{l:"Anomalies",v:stB.ta,c:"#ea580c"},{l:"Mat ↑",v:stB.mp,c:"#16a34a"},{l:"Mat ↓",v:stB.mn,c:"#dc2626"},{l:"Seasonal",v:stB.se,c:"#d97706"},{l:"Recurring",v:stB.rc,c:"#a78bfa"}].forEach(c=>{tbl+=`<td style="background:#edeae6;padding:6px;text-align:center;"><div style="font-size:8px;color:#888;">${c.l}</div><div style="font-size:16px;font-weight:800;color:${c.c};">${c.v}</div></td>`;});
    for(let i=6;i<months.length+8;i++)tbl+=`<td style="background:#edeae6;"></td>`;
    tbl+=`</tr><tr><td colspan="${months.length+8}"></td></tr>`;
    // Header
    tbl+=`<tr style="background:#1a1a24;"><td style="font-weight:bold;color:#a1a1aa;">Metric</td><td style="font-weight:bold;color:#a1a1aa;">Src</td><td style="font-weight:bold;color:#a1a1aa;">Type</td>`;
    months.forEach(m=>tbl+=`<td style="font-weight:bold;color:#a1a1aa;text-align:center;font-size:9px;">${m}</td>`);
    tbl+=`<td style="font-weight:bold;color:#a1a1aa;">Trend</td><td style="font-weight:bold;color:#a1a1aa;">12M</td><td style="font-weight:bold;color:#a1a1aa;">3M</td><td style="font-weight:bold;color:#a1a1aa;">Str Q</td><td style="font-weight:bold;color:#a1a1aa;">Wk Q</td></tr>`;
    // Merged rows
    const mapA=new Map(dataA.map(r=>[r.name,r])),mapB=new Map(dataB.map(r=>[r.name,r]));
    const allNames=[...new Set([...dataA.map(r=>r.name),...dataB.map(r=>r.name)])];
    const mf=COMP_MAT_FOCUS;
    allNames.forEach(name=>{
      const a=mapA.get(name),b=mapB.get(name);
      [["A",a,"#eef0ff"],["B",b,"#fff4ee"]].forEach(([src,met,bgRow])=>{
        if(!met)return;
        const lc=met.sec==="income"?"#16a34a":"#dc2626";
        tbl+=`<tr style="background:${bgRow};">`;
        tbl+=`<td style="color:${lc};font-weight:600;">${met.name}</td>`;
        tbl+=`<td style="text-align:center;font-weight:700;color:${src==="A"?"#4f46e5":"#ea580c"};">${src}</td>`;
        tbl+=`<td style="text-align:center;color:#888;font-size:9px;">${met.mt==="sporadic"?"SPR":"CNT"}</td>`;
        met.res.forEach(r=>{const col=getCellColor(r,mf);let sty="text-align:right;padding:4px;";if(col)sty+=`background:${col.bg};color:${col.fg};font-weight:700;`;const ri=(!mf&&r.recur)?" 🔄":"";tbl+=`<td style="${sty}">${fmt(r.v)}${ri}</td>`;});
        const tc=v=>v>0?"#16a34a":v<0?"#dc2626":"#888";
        tbl+=`<td style="text-align:center;color:${tc(met.tr.all)};">${fmt(met.tr.all)}</td>`;
        tbl+=`<td style="text-align:center;color:${tc(met.tr.m12)};">${fmt(met.tr.m12)}</td>`;
        tbl+=`<td style="text-align:center;color:${tc(met.tr.m3)};">${fmt(met.tr.m3)}</td>`;
        tbl+=`<td style="text-align:center;font-size:9px;">${met.sq?met.sq.k:"—"}</td>`;
        tbl+=`<td style="text-align:center;font-size:9px;">${met.wq?met.wq.k:"—"}</td></tr>`;
      });
    });
    tbl+=`</table>`;
    downloadAsExcel(tbl,"comparison_report.xls");
  }else{
    if(!isFiltered){const oldF=CFILT,oldS=CSEC;CFILT="all";CSEC="all";renderComp();exportHTML("compTable","compStats","compLegend","comparison_report.html");CFILT=oldF;CSEC=oldS;renderComp();}
    else exportHTML("compTable","compStats","compLegend","comparison_report.html");
  }
}
