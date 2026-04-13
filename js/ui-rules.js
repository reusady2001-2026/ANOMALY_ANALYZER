// ══════════════════════════════════════════════════════════════
// SECTION: Rule Candidates Panel
// Ported from OAAS js/ui.js renderRuleCandidates
// ══════════════════════════════════════════════════════════════

(function(){

  function escHtml(s){
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function renderRuleCandidates(candidates, onApprove, onDismiss){
    const panel = document.getElementById('rule-candidates-panel');
    if(!panel) return;

    if(!candidates || candidates.length === 0){
      panel.innerHTML = '';
      panel.style.display = 'none';
      return;
    }

    panel.style.display = 'block';

    const cardsHtml = candidates.map(c => {
      const pt = (c.pattern_type||'').replace(/_/g,' ');
      const rules = Array.isArray(c.suggested_rules) ? c.suggested_rules : [];

      const optionsHtml = rules.map((ruleText, i) => `
        <label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;padding:5px 0;font-family:var(--font-display);font-size:10px;color:var(--text-primary);line-height:1.45;">
          <input type="radio" name="rule_${escHtml(c.id)}" value="${i}" style="margin-top:2px;flex-shrink:0;accent-color:var(--accent);">
          <span>${escHtml(ruleText)}</span>
        </label>
      `).join('');

      const writeOwnHtml = `
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:5px 0;font-family:var(--font-display);font-size:10px;color:var(--text-muted);">
          <input type="radio" name="rule_${escHtml(c.id)}" value="custom" style="flex-shrink:0;accent-color:var(--accent);">
          <span>Write my own:</span>
        </label>
        <input type="text"
          id="custom_${escHtml(c.id)}"
          placeholder="Describe the rule..."
          style="display:none;width:100%;box-sizing:border-box;margin-top:4px;background:var(--bg-base);border:1px solid var(--border);color:var(--text-primary);border-radius:var(--radius);padding:7px 10px;font-size:10px;font-family:var(--font-display);outline:none;transition:border-color 0.2s;"
          onfocus="this.style.borderColor='var(--accent)'" onblur="this.style.borderColor='var(--border)'">
      `;

      const distinctCount = Array.isArray(c.distinct_properties)
        ? c.distinct_properties.length
        : (c.distinct_property_count || 0);

      return `
        <div class="uir-card" data-id="${escHtml(c.id)}" style="padding:16px;border-bottom:1px solid var(--border);">
          <div style="font-family:var(--font-display);font-size:11px;font-weight:700;color:var(--text-primary);margin-bottom:3px;">${escHtml(c.metric_name||'')} \u2014 ${escHtml(pt)}</div>
          <div style="font-family:var(--font-display);font-size:9px;color:var(--text-muted);margin-bottom:8px;letter-spacing:0.4px;">
            Seen ${c.total_occurrences||0} times across ${distinctCount} propert${distinctCount===1?'y':'ies'}
          </div>
          ${c.pattern_description ? `<div style="font-family:var(--font-display);font-size:10px;color:var(--text-secondary,var(--text-muted));margin-bottom:10px;line-height:1.5;">${escHtml(c.pattern_description)}</div>` : ''}
          <div style="margin-bottom:10px;">${optionsHtml}${writeOwnHtml}</div>
          <div style="display:flex;gap:8px;">
            <button class="uir-btn-approve" data-id="${escHtml(c.id)}"
              style="flex:1;background:var(--accent);border:1px solid var(--accent);color:#000;padding:7px 12px;border-radius:var(--radius);cursor:pointer;font-size:10px;font-family:var(--font-display);font-weight:700;letter-spacing:0.5px;transition:opacity 0.15s;"
              onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">Add Rule</button>
            <button class="uir-btn-dismiss" data-id="${escHtml(c.id)}"
              style="background:var(--bg-elevated);border:1px solid var(--border);color:var(--text-muted);padding:7px 12px;border-radius:var(--radius);cursor:pointer;font-size:10px;font-family:var(--font-display);transition:all 0.15s;"
              onmouseover="this.style.borderColor='var(--accent)';this.style.color='var(--accent)'" onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--text-muted)'">Dismiss</button>
          </div>
        </div>
      `;
    }).join('');

    panel.innerHTML = `
      <div style="font-family:var(--font-display);padding:14px 16px;border-bottom:1px solid var(--border);font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--text-primary);">\u{1F4A1} Pattern Detected</div>
      ${cardsHtml}
    `;

    // Wire up radio toggle + approve/dismiss listeners (matching OAAS approach)
    panel.querySelectorAll('.uir-card').forEach(card => {
      const candidateId = card.dataset.id;
      const candidate   = candidates.find(x => x.id === candidateId);
      const radios      = card.querySelectorAll('input[type="radio"]');
      const customInput = document.getElementById('custom_' + candidateId);

      radios.forEach(radio => {
        radio.addEventListener('change', function(){
          if(customInput) customInput.style.display = radio.value === 'custom' ? 'block' : 'none';
        });
      });

      card.querySelector('.uir-btn-approve').addEventListener('click', function(){
        const selected = panel.querySelector('input[name="rule_' + candidateId + '"]:checked');
        if(!selected){ alert('Please select a rule option first.'); return; }
        let ruleText;
        if(selected.value === 'custom'){
          ruleText = (customInput ? customInput.value.trim() : '');
          if(!ruleText){ alert('Please write your rule in the text box.'); return; }
        } else {
          const idx = parseInt(selected.value, 10);
          ruleText = (Array.isArray(candidate?.suggested_rules) ? candidate.suggested_rules[idx] : '') || '';
        }
        onApprove(candidateId, ruleText);
      });

      card.querySelector('.uir-btn-dismiss').addEventListener('click', function(){
        onDismiss(candidateId);
      });
    });
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

  window.UI = window.UI || {};
  window.UI.renderRuleCandidates = renderRuleCandidates;
  window.UI.showRuleCandidates   = showRuleCandidates;

})();
