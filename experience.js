/* Humanlaya interaction layer. No remote data, trackers, or animation dependencies. */
(() => {
  'use strict';
  const D = window.PROFESSIONAL_BENCH;
  const cases = window.PROFESSIONAL_CASES;
  if (!D || !cases) return;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const assetUrl = path => window.PROFESSIONAL_PREVIEW_ASSETS?.[path] || path;
  const fixed = (v, digits = 2) => Number(v).toFixed(digits);
  const domains = {overall:'Overall', finance:'Finance', legal:'Law', healthcare:'Healthcare'};
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const safeLocal = value => typeof value === 'string' && /^(assets|cases)\/[a-zA-Z0-9_./%\-]+$/.test(value) && !value.includes('..') ? value : null;
  const svg = $('#bubble-chart');
  const bubble = {domain:'overall', axis:'cost', active:'gpt', pinned:null, points:[]};
  const bounds = {left:62, right:758, top:52, bottom:375};
  const compactChart = window.matchMedia('(max-width: 600px)');
  let plotWidth = 820;
  const y = value => bounds.bottom - (value - 35) / 40 * (bounds.bottom - bounds.top);
  const x = value => bounds.left + value / (bubble.axis === 'cost' ? 7 : 70) * (bounds.right - bounds.left);
  const selectedModel = () => D.models.find(m => m.id === bubble.active) || D.models[0];

  function renderBubble() {
    const cost = bubble.axis === 'cost';
    const compact = compactChart.matches;
    plotWidth = compact ? 420 : 820;
    Object.assign(bounds, compact ? {left:43,right:390,top:56,bottom:280} : {left:62,right:758,top:52,bottom:375});
    svg.setAttribute('viewBox', compact ? '0 0 420 345' : '0 0 820 450');
    $('#bubble-title').textContent = `${domains[bubble.domain]}: ${cost ? 'cost' : 'time'} and Outcome Score`;
    $('#bubble-size-legend').textContent = `Circle area = ${cost ? 'execution time' : 'cost'}`;
    $('#bubble-scope').textContent = `${bubble.domain === 'overall' ? 90 : 30} tasks · ${domains[bubble.domain]}`;
    $$('[data-eff-domain]').forEach(b => {
      const selected = b.dataset.effDomain === bubble.domain;
      b.classList.toggle('selected', selected); b.setAttribute('aria-pressed', String(selected));
    });
    const defs = `<defs>${D.models.map(m=>`<radialGradient id="orb-${m.id}" cx="30%" cy="25%" r="80%"><stop offset="0%" stop-color="#fff" stop-opacity=".92"/><stop offset="42%" stop-color="${m.color}" stop-opacity=".40"/><stop offset="100%" stop-color="${m.color}" stop-opacity=".82"/></radialGradient>`).join('')}</defs>`;
    const horizontal = (compact ? [35,45,55,65,75] : [35,40,45,50,55,60,65,70,75]).map(v=>`<line class="grid-line" x1="${bounds.left}" x2="${bounds.right}" y1="${y(v)}" y2="${y(v)}"/><text class="axis-text" text-anchor="end" x="${bounds.left-12}" y="${y(v)+4}">${v}</text>`).join('');
    const vertical = (compact ? [0,2,4,6,7] : [0,1,2,3,4,5,6,7]).map(i=>cost?i:i*10).map(v=>`<line class="grid-line" x1="${x(v)}" x2="${x(v)}" y1="${bounds.top}" y2="${bounds.bottom}"/><text class="axis-text" text-anchor="middle" x="${x(v)}" y="${bounds.bottom+25}">${cost?'$':''}${v}</text>`).join('');
    bubble.points = D.models.map(m => {
      const r = m.results[bubble.domain];
      // Area is proportional to the secondary efficiency metric; anchors are never displaced.
      return {id:m.id, cx:x(r[bubble.axis]), cy:y(r.score), radius:Math.sqrt(cost?r.delay:r.cost)*(cost?5.2:18)*(compact ? .75 : 1)};
    });
    const circles = [...bubble.points].sort((a,b)=>b.radius-a.radius).map(p=>{
      const m=D.models.find(m=>m.id===p.id),r=m.results[bubble.domain];
      const label=`${m.name}. Outcome Score ${fixed(r.score)}; cost ${fixed(r.cost)} US dollars; execution time ${fixed(r.delay)} minutes; Professional Pass ${fixed(r.pass,1)} percent.`;
      return `<g class="bubble-node" data-model="${m.id}" role="button" tabindex="0" aria-pressed="false" aria-label="${esc(label)}"><title>${esc(label)}</title><circle class="bubble-hit" cx="${p.cx}" cy="${p.cy}" r="${Math.max(p.radius+9,22)}"/><circle class="bubble-glow" cx="${p.cx}" cy="${p.cy}" r="${p.radius+8}" stroke="${m.color}"/><circle class="bubble-orb" cx="${p.cx}" cy="${p.cy}" r="${p.radius}" fill="url(#orb-${m.id})" stroke="${m.color}"/><circle class="bubble-dot" cx="${p.cx}" cy="${p.cy}" r="3.1" fill="${m.color}"/></g>`;
    }).join('');
    const title = $('#bubble-title').outerHTML, description = $('#bubble-description').outerHTML;
    svg.innerHTML = title+description+defs+`<g aria-hidden="true">${horizontal}${vertical}<text class="axis-title" x="${bounds.left}" y="22">Outcome Score · higher is better</text><text class="axis-title" text-anchor="middle" x="${plotWidth/2}" y="${compact?330:432}">${cost?'Cost per task (USD)':'Execution time per task (minutes)'} · lower is better</text></g><g id="bubble-guides" aria-hidden="true"></g><g id="bubble-nodes">${circles}</g><g id="bubble-callout" class="bubble-callout" aria-hidden="true" style="pointer-events:none"></g>`;
    $('#bubble-legend').innerHTML = D.models.map(m=>`<button type="button" data-select-model="${m.id}" aria-pressed="false"><img src="${esc(assetUrl(m.logo))}" alt="" aria-hidden="true"><span>${esc(m.name)}</span></button>`).join('');
    updateModel();
  }
  function updateModel() {
    const m=selectedModel(), r=m.results[bubble.domain],p=bubble.points.find(p=>p.id===m.id);
    $$('.bubble-node',svg).forEach(node=>{
      node.classList.toggle('is-active',node.dataset.model===m.id);
      node.classList.toggle('is-dimmed',node.dataset.model!==m.id);
      node.setAttribute('aria-pressed',String(node.dataset.model===bubble.pinned));
    });
    $$('[data-select-model]').forEach(b=>{
      b.classList.toggle('selected',b.dataset.selectModel===m.id);
      b.setAttribute('aria-pressed',String(b.dataset.selectModel===bubble.pinned));
    });
    $('#bubble-guides').innerHTML=`<path class="bubble-crosshair" d="M ${bounds.left} ${p.cy} H ${p.cx} V ${bounds.bottom}"/>`;
    const labelWidth=Math.max(108,m.name.length*6.5+22),labelX=Math.min(plotWidth-5-labelWidth,Math.max(5,p.cx-labelWidth/2));
    const labelY=Math.max(27,p.cy-p.radius-37);
    $('#bubble-callout').innerHTML=`<rect x="${labelX}" y="${labelY}" width="${labelWidth}" height="28" rx="9"/><text x="${labelX+labelWidth/2}" y="${labelY+18}" text-anchor="middle">${esc(m.name)}</text>`;
    $('#model-inspector').innerHTML=`<p class="inspector-status"><i aria-hidden="true"></i>${bubble.pinned?'Pinned model':'Exploring model'}</p><div class="inspector-heading"><img src="${esc(assetUrl(m.logo))}" alt="${esc(m.company)}"><div><h3>${esc(m.name)}</h3><p>${esc(m.harness)}</p></div></div><div class="inspector-score"><strong>${fixed(r.score)}</strong><span>/ 100</span></div><dl class="inspector-metrics"><div><dt>Cost / task</dt><dd>$${fixed(r.cost)}</dd></div><div><dt>Time / task</dt><dd>${fixed(r.delay)}<small> min</small></dd></div><div><dt>Professional Pass</dt><dd>${fixed(r.pass,1)}%</dd></div><div><dt>Domain</dt><dd>${domains[bubble.domain]}</dd></div></dl><p class="inspector-foot">${bubble.pinned?'Click the selected model again or press Escape to release.':'Select a circle or model name to pin its details.'}<br>Table 2 · ${bubble.domain==='overall'?'90':'30'} tasks · manuscript results</p>`;
  }
  function activateModel(id, pin=false) {
    if(!D.models.some(m=>m.id===id))return;
    if(pin)bubble.pinned=bubble.pinned===id?null:id;
    if(bubble.active===id&&!pin)return;
    bubble.active=id;updateModel();
  }
  let pointerFrame=0;
  svg.addEventListener('pointermove',event=>{
    if(bubble.pinned||event.pointerType==='touch')return;
    cancelAnimationFrame(pointerFrame);
    const clientX=event.clientX,clientY=event.clientY;
    pointerFrame=requestAnimationFrame(()=>{
      if(bubble.pinned)return;
      const matrix=svg.getScreenCTM();if(!matrix)return;
      const point=new DOMPoint(clientX,clientY).matrixTransform(matrix.inverse());
      const nearest=bubble.points.map(p=>({...p,distance:Math.hypot(point.x-p.cx,point.y-p.cy)})).sort((a,b)=>a.distance-b.distance)[0];
      if(nearest&&nearest.distance<nearest.radius+36)activateModel(nearest.id);
    });
  });
  svg.addEventListener('click',e=>{const node=e.target.closest('[data-model]');if(node)activateModel(node.dataset.model,true);});
  svg.addEventListener('focusin',e=>{const node=e.target.closest('[data-model]');if(node&&!bubble.pinned)activateModel(node.dataset.model);});
  svg.addEventListener('keydown',e=>{
    const node=e.target.closest('[data-model]');if(!node)return;
    if(e.key==='Enter'||e.key===' '){e.preventDefault();activateModel(node.dataset.model,true);}
    if(['ArrowRight','ArrowLeft','ArrowUp','ArrowDown','Home','End'].includes(e.key)){
      e.preventDefault();const nodes=$$('.bubble-node',svg),i=nodes.indexOf(node);
      const next=e.key==='Home'?0:e.key==='End'?nodes.length-1:(i+(['ArrowLeft','ArrowUp'].includes(e.key)?-1:1)+nodes.length)%nodes.length;
      nodes[next].focus();
    }
  });
  $('#bubble-legend').addEventListener('click',e=>{const b=e.target.closest('[data-select-model]');if(b)activateModel(b.dataset.selectModel,true);});
  $('#eff-axis').addEventListener('change',e=>{bubble.axis=e.target.value;renderBubble();});
  $$('[data-eff-domain]').forEach(b=>b.addEventListener('click',()=>{bubble.domain=b.dataset.effDomain;renderBubble();}));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&bubble.pinned){bubble.pinned=null;updateModel();}});

  // Case evidence is data-driven. No synthetic trace is shown when a run has not been released.
  const caseState={id:cases[0].id,tab:'trajectory',step:0,playing:false};
  let playback=0;
  function stopPlayback(){clearTimeout(playback);caseState.playing=false;}
  function currentCase(){return cases.find(c=>c.id===caseState.id)||cases[0];}
  function renderCase(){
    const c=currentCase(), panel=$('#case-panel');
    $$('[data-case]').forEach(b=>{const chosen=b.dataset.case===c.id;b.classList.toggle('selected',chosen);b.setAttribute('aria-pressed',String(chosen));});
    $$('[data-case-tab]').forEach(b=>{const chosen=b.dataset.caseTab===caseState.tab;b.setAttribute('aria-selected',String(chosen));b.tabIndex=chosen?0:-1;});
    panel.setAttribute('aria-labelledby','case-tab-'+caseState.tab);
    if(caseState.tab==='trajectory'){
      const steps=c.trajectory?.steps;
      if(!steps?.length){
        panel.innerHTML=`<div class="trace-empty"><div class="trace-route" aria-hidden="true"><span>K</span><i></i><span>A</span><i></i><span>C</span></div><h4>A closer look, coming soon.</h4><p>Step-by-step agent actions, tool calls, and supporting evidence for this case will appear here when the trajectory is released.</p><a href="#paper-figure-${c.id==='finance'?7:c.id==='legal'?8:9}">Explore the paper’s task example ↗</a></div>`;
      }else{
        caseState.step=Math.min(caseState.step,steps.length-1);
        const step=steps[caseState.step];
        panel.innerHTML=`<p class="case-panel-note">${esc(c.trajectory.model||'Released run')} · ${caseState.step+1} / ${steps.length} steps</p><article class="trace-step"><small>${esc(step.phase)}${step.tool?' · '+esc(step.tool):''}</small><h4>${esc(step.title)}</h4><p>${esc(step.summary)}</p>${(step.evidence||[]).filter(e=>safeLocal(e.href)).map(e=>`<a href="${esc(e.href)}" target="_blank" rel="noopener">${esc(e.label)} ↗</a>`).join('')}</article><div class="trace-player-controls"><button type="button" data-trace="previous" ${caseState.step===0?'disabled':''}>← Previous</button><button type="button" data-trace="play">${caseState.playing?'Pause':'Play'}</button><button type="button" data-trace="next" ${caseState.step===steps.length-1?'disabled':''}>Next →</button></div>`;
      }
    }else if(caseState.tab==='deliverables'){
      panel.innerHTML=`<h4 class="case-panel-title">Expected deliverables</h4><p class="case-panel-note">Requirements from the manuscript. Agent-generated output files will be linked here with the released run.</p><div class="deliverable-list">${c.deliverables.map(d=>`<div class="deliverable-item"><span class="file-type">${esc(d.format)}</span><div><strong>${esc(d.title)}</strong><small>${esc(d.description)}</small>${safeLocal(d.href)?`<a href="${esc(d.href)}" target="_blank" rel="noopener">Open file ↗</a>`:''}</div></div>`).join('')}</div>`;
    }else{
      panel.innerHTML=`<h4 class="case-panel-title">Responsibility-aligned evaluation</h4><p class="case-panel-note">The task’s acceptance criteria connect professional responsibilities to observable evidence. Run-level rubric verdicts will appear with the released trajectory.</p><div class="evaluation-preview">${Object.entries(c.responsibilities).map(([key,value])=>`<div><b>${esc(key)}</b><p>${esc(value)}</p></div>`).join('')}</div>`;
    }
  }
  function scheduleStep(){
    clearTimeout(playback);
    if(!caseState.playing)return;
    playback=setTimeout(()=>{
      const steps=currentCase().trajectory?.steps||[];
      if(caseState.step>=steps.length-1){stopPlayback();renderCase();return;}
      caseState.step++;renderCase();scheduleStep();
    },3500);
  }
  $$('[data-case]').forEach(b=>b.addEventListener('click',()=>{stopPlayback();caseState.id=b.dataset.case;caseState.step=0;renderCase();}));
  $$('[data-case-tab]').forEach(b=>b.addEventListener('click',()=>{stopPlayback();caseState.tab=b.dataset.caseTab;renderCase();}));
  $('.case-tabs').addEventListener('keydown',e=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
    e.preventDefault();const tabs=$$('[data-case-tab]'),i=tabs.indexOf(document.activeElement);
    const next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
    tabs[next].click();tabs[next].focus();
  });
  $('#case-panel').addEventListener('click',e=>{
    const control=e.target.closest('[data-trace]');if(!control)return;
    const steps=currentCase().trajectory?.steps||[];if(!steps.length)return;
    if(control.dataset.trace==='play'){
      if(caseState.playing)stopPlayback();else{caseState.playing=true;if(caseState.step===steps.length-1)caseState.step=0;scheduleStep();}
    }else{stopPlayback();caseState.step=Math.max(0,Math.min(steps.length-1,caseState.step+(control.dataset.trace==='next'?1:-1)));}
    renderCase();
    $(`[data-trace="${control.dataset.trace}"]`)?.focus();
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden){stopPlayback();if(caseState.tab==='trajectory')renderCase();}});
  // Gentle pointer response stays decorative and turns off for reduced motion/touch.
  const hero=$('.hero-centered');
  let heroFrame=0;
  hero.addEventListener('pointermove',e=>{
    if(reduced.matches||e.pointerType==='touch')return;
    cancelAnimationFrame(heroFrame);
    const rect=hero.getBoundingClientRect(),dx=(e.clientX-rect.left)/rect.width-.5,dy=(e.clientY-rect.top)/rect.height-.5;
    heroFrame=requestAnimationFrame(()=>{hero.style.setProperty('--orbit-x',`${dx*16}px`);hero.style.setProperty('--orbit-y',`${dy*12}px`);});
  });
  hero.addEventListener('pointerleave',()=>{cancelAnimationFrame(heroFrame);hero.style.removeProperty('--orbit-x');hero.style.removeProperty('--orbit-y');});
  compactChart.addEventListener('change',renderBubble);
  renderBubble();renderCase();
})();
