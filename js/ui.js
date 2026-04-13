// ══════════════════════════════════════════════════════════════
// SECTION: UI — Rule Candidates Panel
// ══════════════════════════════════════════════════════════════

var UI = (function(){

  function renderRuleCandidates(candidates, onApprove, onDismiss){
    const panel = document.getElementById('rule-candidates-panel');
    if(!panel) return;
    if(!candidates || !candidates.length){
      panel.innerHTML = '';
      panel.style.display = 'none';
      return;
    }
    panel.style.display = 'block';

    let html = `
      <style>@keyframes rcPulse{0%,100%{opacity:1}50%{opacity:0.35}}</style>
      <div style="font-family:var(--font-display);padding:14px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;">
        <span style="width:7px;height:7px;border-radius:50%;background:var(--accent);box-shadow:0 0 12px var(--accent),0 0 4px var(--accent);display:inline-block;flex-shrink:0;animation:rcPulse 1.8s ease-in-out infinite;"></span>
        <span style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--text-primary);">Pattern Candidates</span>
        <span style="font-size:9px;color:var(--text-muted);margin-left:auto;">${candidates.length} surfaced</span>
      </div>
    `;

    candidates.forEach(function(c, idx){
      const rules = Array.isArray(c.suggested_rules) ? c.suggested_rules : [];
      const radioName = 'rc_rule_' + idx;

      let rulesHtml = '';
      rules.slice(0, 3).forEach(function(r, ri){
        rulesHtml += `
          <label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;padding:6px 8px;border-radius:var(--radius);border:1px solid var(--border);margin-bottom:5px;background:var(--bg-base);">
            <input type="radio" name="${radioName}" value="${ri}" style="margin-top:2px;flex-shrink:0;accent-color:var(--accent);">
            <span style="font-size:10px;color:var(--text-primary);font-family:var(--font-display);line-height:1.45;">${r}</span>
          </label>
        `;
      });
      rulesHtml += `
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:6px 8px;border-radius:var(--radius);border:1px solid var(--border);margin-bottom:5px;background:var(--bg-base);">
          <input type="radio" name="${radioName}" value="custom" style="flex-shrink:0;accent-color:var(--accent);">
          <span style="font-size:10px;color:var(--text-muted);font-family:var(--font-display);">Custom rule\u2026</span>
        </label>
        <textarea id="rc_custom_${idx}" placeholder="Write a custom rule..." style="width:100%;box-sizing:border-box;background:var(--bg-base);border:1px solid var(--border);color:var(--text-primary);border-radius:var(--radius);padding:7px 10px;font-size:10px;font-family:var(--font-display);resize:vertical;min-height:58px;display:none;margin-bottom:5px;outline:none;transition:border-color 0.2s;"></textarea>
      `;

      const occSince = c.occurrences_since_last_dismissal || 0;
      const distinctCount = Array.isArray(c.distinct_properties) ? c.distinct_properties.length : (c.distinct_property_count || 0);

      html += `
        <div id="rc_card_${idx}" data-candidate-id="${c.id}" style="padding:16px 18px;border-bottom:1px solid var(--border);">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:8px;">
            <div>
              <div style="font-family:var(--font-display);font-size:11px;font-weight:700;color:var(--text-primary);margin-bottom:3px;">${c.metric_name||''}</div>
              <div style="font-size:9px;color:var(--text-muted);font-family:var(--font-display);letter-spacing:0.5px;text-transform:uppercase;">${c.pattern_type||''}&nbsp;·&nbsp;${c.section||''}</div>
            </div>
            <div style="text-align:right;flex-shrink:0;">
              <div style="font-family:var(--font-display);font-size:18px;font-weight:800;color:var(--accent);">${c.total_occurrences||0}</div>
              <div style="font-size:8px;color:var(--text-muted);font-family:var(--font-display);letter-spacing:0.4px;">occurrences</div>
            </div>
          </div>
          ${c.pattern_description ? `<div style="font-size:10px;color:var(--text-secondary);font-family:var(--font-display);margin-bottom:10px;line-height:1.5;">${c.pattern_description}</div>` : ''}
          <div style="display:flex;gap:12px;margin-bottom:12px;">
            <div style="font-size:9px;color:var(--text-muted);font-family:var(--font-display);">${distinctCount} propert${distinctCount===1?'y':'ies'}</div>
            <div style="font-size:9px;color:var(--text-muted);font-family:var(--font-display);">${occSince} since last dismissal</div>
          </div>
          <div style="margin-bottom:12px;">${rulesHtml}</div>
          <div style="display:flex;gap:8px;">
            <button onclick="UI._approveCandidate(${idx})" style="flex:1;background:var(--accent);border:1px solid var(--accent);color:#000;padding:7px 12px;border-radius:var(--radius);cursor:pointer;font-size:10px;font-family:var(--font-display);font-weight:700;letter-spacing:0.5px;transition:opacity 0.15s;" onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">Approve Rule</button>
            <button onclick="UI._dismissCandidate(${idx})" style="background:var(--bg-elevated);border:1px solid var(--border);color:var(--text-muted);padding:7px 12px;border-radius:var(--radius);cursor:pointer;font-size:10px;font-family:var(--font-display);transition:all 0.15s;" onmouseover="this.style.borderColor='var(--accent)';this.style.color='var(--accent)'" onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--text-muted)'">Dismiss</button>
          </div>
        </div>
      `;
    });

    panel.innerHTML = html;

    // Store callbacks for button handlers
    panel._candidates = candidates;
    panel._onApprove = onApprove;
    panel._onDismiss = onDismiss;

    // Wire up custom textarea toggle + default-select first radio
    candidates.forEach(function(c, idx){
      const radioName = 'rc_rule_' + idx;
      const textarea = document.getElementById('rc_custom_' + idx);
      if(!textarea) return;
      panel.querySelectorAll('input[name="' + radioName + '"]').forEach(function(radio){
        radio.addEventListener('change', function(){
          textarea.style.display = radio.value === 'custom' ? 'block' : 'none';
          if(radio.value === 'custom') textarea.focus();
        });
        radio.addEventListener('focus', function(){
          textarea.style.borderColor = 'var(--accent)';
        });
      });
      textarea.addEventListener('blur', function(){ textarea.style.borderColor = 'var(--border)'; });
      const first = panel.querySelector('input[name="' + radioName + '"]');
      if(first) first.checked = true;
    });
  }

  function _approveCandidate(idx){
    const panel = document.getElementById('rule-candidates-panel');
    if(!panel || !panel._candidates) return;
    const c = panel._candidates[idx];
    if(!c) return;
    const radioName = 'rc_rule_' + idx;
    const selected = panel.querySelector('input[name="' + radioName + '"]:checked');
    let ruleText = '';
    if(selected && selected.value === 'custom'){
      ruleText = (document.getElementById('rc_custom_' + idx)?.value || '').trim();
    } else if(selected){
      const ri = parseInt(selected.value, 10);
      ruleText = (Array.isArray(c.suggested_rules) ? c.suggested_rules[ri] : '') || '';
    }
    if(!ruleText){ alert('Please select or write a rule before approving.'); return; }
    if(typeof panel._onApprove === 'function') panel._onApprove(c.id, ruleText);
  }

  function _dismissCandidate(idx){
    const panel = document.getElementById('rule-candidates-panel');
    if(!panel || !panel._candidates) return;
    const c = panel._candidates[idx];
    if(!c) return;
    if(typeof panel._onDismiss === 'function') panel._onDismiss(c.id);
  }

  async function showRuleCandidates(){
    try{
      const r = await fetch('/api/get-rule-candidates', {cache:'no-store'});
      if(!r.ok) return;
      const d = await r.json();
      if(!d.success) return;
      window._ruleCandidates = d.candidates;
      renderRuleCandidates(
        d.candidates,
        async function onApprove(candidateId, ruleText){
          try{
            await fetch('/api/save-rule', {method:'POST', cache:'no-store',
              headers:{'Content-Type':'application/json'},
              body:JSON.stringify({action:'approve', candidateId, ruleText})});
          }catch(e){ console.warn('[saveRule] approve failed:', e); }
          showRuleCandidates();
        },
        async function onDismiss(candidateId){
          try{
            await fetch('/api/save-rule', {method:'POST', cache:'no-store',
              headers:{'Content-Type':'application/json'},
              body:JSON.stringify({action:'dismiss', candidateId})});
          }catch(e){ console.warn('[saveRule] dismiss failed:', e); }
          showRuleCandidates();
        }
      );
    }catch(e){
      console.warn('[showRuleCandidates] failed:', e);
    }
  }

  return { renderRuleCandidates, showRuleCandidates, _approveCandidate, _dismissCandidate };
})();
