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
  const bubble = {domain:'overall', active:'gpt', pinned:null, points:[]};
  const bounds = {left:76, right:1054, top:64, bottom:432};
  const compactChart = window.matchMedia('(max-width: 600px)');
  let plotWidth = 1100;
  let axisMaximum = 60;
  let axisStep = 10;
  const y = value => bounds.bottom - (value - 35) / 40 * (bounds.bottom - bounds.top);
  const x = value => bounds.left + value / axisMaximum * (bounds.right - bounds.left);
  function fitHorizontalScale() {
    const maximum=Math.max(...D.models.map(m=>m.results[bubble.domain].delay));
    const target=maximum*1.08/6;
    const magnitude=10**Math.floor(Math.log10(target));
    const candidates=[1,2,2.5,5,10].map(v=>v*magnitude);
    axisStep=candidates.reduce((best,value)=>Math.abs(value-target)<Math.abs(best-target)?value:best);
    axisMaximum=Math.ceil(maximum*1.08/axisStep)*axisStep;
  }
  const selectedModel = () => D.models.find(m => m.id === bubble.active) || D.models[0];

  function renderBubble() {
    const compact = compactChart.matches;
    plotWidth = compact ? 420 : 1100;
    fitHorizontalScale();
    Object.assign(bounds, compact ? {left:48,right:376,top:56,bottom:306} : {left:76,right:1054,top:64,bottom:432});
    svg.setAttribute('viewBox', compact ? '0 0 420 375' : '0 0 1100 505');
    $('#bubble-title').textContent = `${domains[bubble.domain]}: execution time and Outcome Score; circle area represents cost`;
    $('#bubble-size-legend').textContent = 'Circle area = cost (USD/task)';
    $('#bubble-scope').textContent = `${bubble.domain === 'overall' ? 90 : 30} tasks · ${domains[bubble.domain]}`;
    $$('[data-eff-domain]').forEach(b => {
      const selected = b.dataset.effDomain === bubble.domain;
      b.classList.toggle('selected', selected); b.setAttribute('aria-pressed', String(selected));
    });
    const defs = `<defs>${D.models.map(m=>`<radialGradient id="orb-${m.id}" cx="32%" cy="28%" r="85%"><stop offset="0%" stop-color="${m.color}" stop-opacity=".55"/><stop offset="48%" stop-color="${m.color}" stop-opacity=".8"/><stop offset="100%" stop-color="${m.color}" stop-opacity=".94"/></radialGradient>`).join('')}</defs>`;
    const horizontal = (compact ? [35,45,55,65,75] : [35,40,45,50,55,60,65,70,75]).map(v=>`<line class="grid-line" x1="${bounds.left}" x2="${bounds.right}" y1="${y(v)}" y2="${y(v)}"/><text class="axis-text" text-anchor="end" x="${bounds.left-12}" y="${y(v)+4}">${v}</text>`).join('');
    const tickCount=Math.round(axisMaximum/axisStep);
    const ticks=Array.from({length:tickCount+1},(_,i)=>Number((i*axisStep).toFixed(3))).filter((v,i)=>!compact||i%2===0||i===tickCount);
    const vertical=ticks.map(v=>`<line class="grid-line" x1="${x(v)}" x2="${x(v)}" y1="${bounds.top}" y2="${bounds.bottom}"/><text class="axis-text" text-anchor="middle" x="${x(v)}" y="${bounds.bottom+25}">${Number(v.toFixed(2))}</text>`).join('');
    bubble.points = D.models.map(m => {
      const r = m.results[bubble.domain];
      // A = πr²: using sqrt(cost) makes circle area proportional to USD per task.
      return {id:m.id, cx:x(r.delay), cy:y(r.score), radius:Math.sqrt(r.cost)*21*(compact ? .52 : 1)};
    });
    const circles = [...bubble.points].sort((a,b)=>b.radius-a.radius).map(p=>{
      const m=D.models.find(m=>m.id===p.id),r=m.results[bubble.domain];
      const label=`${m.name}. Outcome Score ${fixed(r.score)}; cost ${fixed(r.cost)} US dollars; execution time ${fixed(r.delay)} minutes; Professional Pass ${fixed(r.pass,1)} percent.`;
      return `<g class="bubble-node" data-model="${m.id}" role="button" tabindex="0" aria-pressed="false" aria-label="${esc(label)}"><title>${esc(label)}</title><circle class="bubble-hit" cx="${p.cx}" cy="${p.cy}" r="${Math.max(p.radius+9,22)}"/><circle class="bubble-glow" cx="${p.cx}" cy="${p.cy}" r="${p.radius+8}" stroke="${m.color}"/><circle class="bubble-orb" cx="${p.cx}" cy="${p.cy}" r="${p.radius}" fill="url(#orb-${m.id})" stroke="${m.color}"/><circle class="bubble-dot" cx="${p.cx}" cy="${p.cy}" r="3.1" fill="${m.color}"/></g>`;
    }).join('');
    const title = $('#bubble-title').outerHTML, description = $('#bubble-description').outerHTML;
    svg.innerHTML = title+description+defs+`<g aria-hidden="true">${horizontal}${vertical}<text class="axis-title" x="${bounds.left}" y="22">Outcome Score · higher is better</text><text class="axis-title" text-anchor="middle" x="${plotWidth/2}" y="${compact?363:489}">Execution time per task (minutes) · lower is better</text></g><g id="bubble-guides" aria-hidden="true"></g><g id="bubble-nodes">${circles}</g><g id="bubble-callout" class="bubble-callout" aria-hidden="true" style="pointer-events:none"></g>`;
    $('#bubble-legend').innerHTML = D.models.map(m=>`<button type="button" data-select-model="${m.id}" aria-pressed="false"><img src="${esc(assetUrl(m.logo))}" alt="" aria-hidden="true"><i class="legend-swatch" style="--swatch:${m.color}" aria-hidden="true"></i><span>${esc(m.name)}</span></button>`).join('');
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
    $('#model-inspector').innerHTML=`<div class="inspector-heading"><img src="${esc(assetUrl(m.logo))}" alt="${esc(m.company)}"><div><h3>${esc(m.name)}</h3><p>${esc(m.harness)}${bubble.pinned?' · pinned':''}</p></div></div><div class="inspector-score"><strong>${fixed(r.score)}</strong><span>Outcome Score</span></div><dl class="inspector-metrics"><div><dt>Cost / task</dt><dd>$${fixed(r.cost)}</dd></div><div><dt>Time / task</dt><dd>${fixed(r.delay)}<small> min</small></dd></div><div><dt>Professional Pass</dt><dd>${fixed(r.pass,1)}%</dd></div></dl>`;
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
  $$('[data-eff-domain]').forEach(b=>b.addEventListener('click',()=>{bubble.domain=b.dataset.effDomain;renderBubble();}));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&bubble.pinned){bubble.pinned=null;updateModel();}});

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
  renderBubble();
})();
