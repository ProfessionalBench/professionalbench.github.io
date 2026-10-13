
/* ProfessionalBench static presentation. No external libraries, tracking, or backend calls. */
(() => {
  'use strict';
  const D = window.PROFESSIONAL_BENCH;
  if (!D || !Array.isArray(D.models)) {
    console.error('ProfessionalBench data is missing. Include data/benchmark-data.js before app.js.');
    return;
  }
  const $ = (q, root = document) => root.querySelector(q);
  const $$ = (q, root = document) => [...root.querySelectorAll(q)];
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number = (value, digits = 0) => Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : '—';
  const color = value => /^#[a-f\d]{6}$/i.test(value || '') ? value : '#397a69';
  const percent = value => Math.max(0, Math.min(100, Number(value) || 0));
  // Only serve locally bundled assets in the showcase viewer, never arbitrary navigation URLs.
  const localPath = value => typeof value === 'string' && /^(?:\.\/)?(?:assets|cases)\/[a-zA-Z0-9_./%\-]+$/.test(value) && !value.includes('..') ? value : null;
  const domainNames = {overall:'Overall', finance:'Finance', legal:'Law', healthcare:'Healthcare'};
  const state = {domain:'overall', sort:'score', compression:'close', caseId:null, caseTab:'task'};
  const icons = {
    finance: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9h18M4 20h16M2 22h20M4 9l8-6 8 6M6 12v6M10 12v6M14 12v6M18 12v6"/></svg>',
    legal: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v17M7 22h10M5 7h14M12 3l1 2-1 2-1-2zM5 7l-3 8h6L5 7zm14 0-3 8h6l-3-8zM2 15c1 3 5 3 6 0M16 15c1 3 5 3 6 0"/></svg>',
    healthcare: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3h8v5h5v8h-5v5H8v-5H3V8h5z"/></svg>'
  };
  const assetUrl = path => window.PROFESSIONAL_PREVIEW_ASSETS?.[path] || path;
  const mark = m => `<span class="model-mark" style="--model-color:${color(m.color)}" aria-hidden="true">${localPath(m.logo) ? `<img src="${escape(assetUrl(m.logo))}" alt="">` : escape(m.mark)}</span>`;
  function sortModels(domain, metric) {
    const sign = ['cost','delay'].includes(metric) ? 1 : -1;
    return [...D.models].sort((a,b) => sign * (a.results[domain][metric] - b.results[domain][metric]) || b.results[domain].score - a.results[domain].score || a.name.localeCompare(b.name));
  }
  function setSelected(buttons, key, value) {
    buttons.forEach(b => {
      const selected = b.dataset[key] === value;
      b.classList.toggle('selected', selected);
      b.setAttribute('aria-pressed', String(selected));
    });
  }
  function renderChart(metric, target) {
    const sorted = sortModels(state.domain, metric);
    target.innerHTML = sorted.map(m => {
      const v=m.results[state.domain][metric], label=number(v, metric==='pass'?1:2)+(metric==='pass'?'%':'');
      return `<div class="chart-row" style="--model-color:${color(m.color)}"><div class="chart-model" title="${escape(m.name)} · ${escape(m.harness)}">${mark(m)}<span>${escape(m.name)}</span></div><div class="bar-track" aria-hidden="true"><div class="bar-fill" style="width:${percent(v)}%"></div></div><strong class="chart-value">${label}</strong></div>`;
    }).join('');
    target.setAttribute('aria-label', `${domainNames[state.domain]} ${metric==='pass'?'Professional Pass Rate':'Outcome Score'}: ${sorted.map(m => `${m.name} ${number(m.results[state.domain][metric],metric==='pass'?1:2)}${metric==='pass'?' percent':''}`).join('; ')}`);
  }
  function renderBoard() {
    setSelected($$('[data-domain]'), 'domain', state.domain);
    $('#scope-label').textContent = state.domain==='overall' ? '90 tasks · all three domains' : `30 tasks · ${domainNames[state.domain]}`;
    renderChart('score', $('#score-chart'));
    renderChart('pass', $('#pass-chart'));
    const models = sortModels(state.domain, state.sort);
    const bestScore = Math.max(...models.map(m=>m.results[state.domain].score));
    const bestPass = Math.max(...models.map(m=>m.results[state.domain].pass));
    let prev, rank=1;
    $('#leaderboard-body').innerHTML=models.map((m,i)=>{
      const r=m.results[state.domain];
      if(i===0 || r[state.sort]!==prev)rank=i+1;
      prev=r[state.sort];
      return `<tr><td><span class="table-rank">${String(rank).padStart(2,'0')}</span></td><td><div class="table-model">${mark(m)}<span><strong>${escape(m.name)}</strong><small>${escape(m.harness)} · ${escape(m.harnessVersion)}</small></span></div></td><td class="${r.score===bestScore?'best':''}">${number(r.score,2)}</td><td class="${r.pass===bestPass?'best':''}">${number(r.pass,1)}%</td><td>${number(r.delay,2)}</td><td>$${number(r.cost,2)}</td></tr>`;
    }).join('');
    const headers=$$('.leaderboard-table th');
    headers.forEach(h=>h.removeAttribute('aria-sort'));
    headers[{score:2,pass:3,delay:4,cost:5}[state.sort]].setAttribute('aria-sort', ['delay','cost'].includes(state.sort)?'ascending':'descending');
    $('.leaderboard-table caption').textContent=`${domainNames[state.domain]} results; sorted by ${state.sort}. Manuscript snapshot ${D.meta.manuscriptDate}.`;
  }
  function renderDomains() {
    $('#domain-grid').innerHTML=D.domains.map(d=>`<article class="domain-card ${escape(d.class)}"><div class="domain-card-header"><span class="domain-icon" aria-hidden="true">${icons[d.id]||''}</span><h3>${escape(d.name)}</h3></div><div class="domain-body"><div class="domain-tasks">${d.tasks}<small>validated tasks</small></div><p>${escape(d.description)}</p><div class="domain-detail-grid"><div><strong>${d.subdomains}</strong><span>subdomains</span></div><div><strong>${d.units}</strong><span>professional units</span></div><div><strong>${d.workflows}</strong><span>anchor workflows</span></div></div><div class="domain-share-track" aria-hidden="true"><span style="width:${percent(d.tasks/D.stats.tasks*100)}%"></span></div><div class="domain-share-label">${number(d.tasks/D.stats.tasks*100,1)}% of the full task collection</div></div></article>`).join('');
  }
  function renderCompression() {
    $('#compression-bars').innerHTML=D.compression.map(c=>`<div class="compression-row"><span>${escape(c.name)}</span><div class="compression-track" aria-hidden="true"><i style="width:${percent(c.gain/10*100)}%;background:${color(c.color)}"></i></div><b>+${number(c.gain,2)}</b></div>`).join('');
    $('#compression-bars').setAttribute('aria-label',D.compression.map(c=>`${c.name}: plus ${number(c.gain,2)} Outcome Score points`).join('; '));
    const c=D.compression.find(c=>c.id===state.compression);
    setSelected($$('[data-compression]'),'compression',state.compression);
    $('#intervention-detail').innerHTML=`<h3>${escape(c.name)}</h3><p>${escape(c.support)}</p><div class="intervention-impact"><strong style="color:${color(c.color)}">${number(c.rate,1)}%</strong><span>of all matched pairs change<br>from Not Passed to Passed</span></div><p>${c.failToPass} of 90 task–model pairs. No Pass-to-Fail transitions were observed in this sample.</p><div class="acceptance-transition"><span>Pooled Professional Pass</span><span>12.2%</span><span aria-hidden="true">→</span><strong>${number(c.pooledPass,1)}%</strong></div>`;
  }
  function renderFailures() {
    $('#failure-stack').innerHTML=D.failures.map(f=>`<span style="width:${percent(f.value)}%;background:${color(f.color)}" title="${escape(f.name)}: ${number(f.value,1)}%"></span>`).join('');
    $('#failure-stack').setAttribute('aria-label',D.failures.map(f=>`${f.name} ${number(f.value,1)} percent`).join('; '));
    $('#failure-legend').innerHTML=D.failures.map(f=>`<span><span><i style="background:${color(f.color)}" aria-hidden="true"></i>${escape(f.name)}</span><strong>${number(f.value,1)}%</strong></span>`).join('');
  }
  function openDialog(id) {
    const dlg=document.getElementById(id);
    dlg.showModal();document.body.style.overflow='hidden';
  }
  const figureZoomLevels=[100,150,200,300,400,600];
  let figureZoomIndex=0;
  function zoomFigure(index, reset=false) {
    const viewport=$('.figure-scroll');
    const previous=figureZoomLevels[figureZoomIndex];
    figureZoomIndex=Math.max(0,Math.min(index,figureZoomLevels.length-1));
    const current=figureZoomLevels[figureZoomIndex];
    const left=viewport.scrollLeft, top=viewport.scrollTop;
    $('.figure-canvas').style.width=current+'%';
    $('#figure-zoom-value').textContent=current+'%';
    $('#figure-zoom-out').disabled=figureZoomIndex===0;
    $('#figure-zoom-in').disabled=figureZoomIndex===figureZoomLevels.length-1;
    viewport.scrollLeft=reset?0:(left+viewport.clientWidth/2)*current/previous-viewport.clientWidth/2;
    viewport.scrollTop=reset?0:(top+viewport.clientHeight/2)*current/previous-viewport.clientHeight/2;
  }
  $('#figure-zoom-out').addEventListener('click',()=>zoomFigure(figureZoomIndex-1));
  $('#figure-zoom-in').addEventListener('click',()=>zoomFigure(figureZoomIndex+1));
  $('#figure-zoom-fit').addEventListener('click',()=>zoomFigure(0,true));
  async function copyCitation() {
    const text=D.meta.citation;
    try {
      if(navigator.clipboard && window.isSecureContext){await navigator.clipboard.writeText(text);}
      else {
        const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.left='-9999px';document.body.append(ta);ta.select();
        const success=document.execCommand('copy');ta.remove();if(!success)throw Error('Clipboard unavailable');
      }
      $('#copy-citation').textContent='Copied';$('#copy-status').textContent='Manuscript citation copied.';
      setTimeout(()=>$('#copy-citation').textContent='Copy',1800);
    } catch {
      const range=document.createRange();range.selectNodeContents($('#citation-text'));const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);
      $('#copy-status').textContent='Citation selected. Press Control+C or Command+C to copy.';
      $('#copy-citation').textContent='Select + copy';
    }
  }
  document.addEventListener('click',e=>{
    const target=e.target.closest('button,a');if(!target)return;
    if(target.dataset.domain){state.domain=target.dataset.domain;renderBoard();}
    if(target.dataset.compression){state.compression=target.dataset.compression;renderCompression();}
    if(target.dataset.close){document.getElementById(target.dataset.close).close();}
    if(target.dataset.figure){
      $('#figure-dialog-title').textContent=target.dataset.figureTitle||'Paper figure';
      $('#figure-dialog-image').src=target.dataset.figure;
      $('#figure-dialog-image').alt=target.dataset.figureTitle||'ProfessionalBench paper figure';
      $('#figure-original').href=target.dataset.figure;
      const isVector=/\.svg(?:[?#]|$)|^data:image\/svg\+xml/.test(target.dataset.figure);
      $('#figure-format-note').textContent=isVector?'Vector · zoom without blur':'Scroll to explore details';
      openDialog('figure-dialog');
      zoomFigure(0,true);
    }
    if(target.closest('#navigation')){
      $('#navigation').classList.remove('is-open');$('.nav-toggle').setAttribute('aria-expanded','false');
    }
  });
  $('#sort-by').addEventListener('change',e=>{state.sort=e.target.value;renderBoard();});
  $('.nav-toggle').addEventListener('click',()=>{
    const open=$('#navigation').classList.toggle('is-open');$('.nav-toggle').setAttribute('aria-expanded',String(open));
  });
  $('#copy-citation').addEventListener('click',copyCitation);
  $$('dialog').forEach(dlg=>{
    dlg.addEventListener('close',()=>{
      if(!$$('dialog[open]').length)document.body.style.overflow='';
    });
    dlg.addEventListener('click',e=>{
      const r=dlg.getBoundingClientRect();
      if(e.target===dlg && (e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))dlg.close();
    });
  });
  // Active navigation is decorative; all anchors still work without it.
  if('IntersectionObserver' in window){
    const navLinks=$$('#navigation a');
    const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
      if(entry.isIntersecting)navLinks.forEach(a=>a.classList.toggle('active',a.hash==='#'+entry.target.id));
    }),{rootMargin:'-15% 0px -65% 0px',threshold:0});
    navLinks.forEach(a=>{const section=$(a.hash);if(section)observer.observe(section);});
  }
  renderBoard();renderDomains();renderCompression();renderFailures();
})();

