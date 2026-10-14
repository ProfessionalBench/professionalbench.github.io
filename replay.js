/* Recorded case replay. Content is rendered as text; no archived code is executed. */
(() => {
  'use strict';
  const $ = (q, root = document) => root.querySelector(q);
  const $$ = (q, root = document) => [...root.querySelectorAll(q)];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
  const local = value => typeof value === 'string' && value.startsWith('cases/') && !value.includes('..') && !/[\\<>"']/.test(value) ? encodeURI(value) : '';
  const num = value => Number(value).toLocaleString('en-US');
  const score = value => Number(value).toFixed(2);
  const labels = {task:'Task', trajectory:'Trajectory', results:'Scores & failure points', files:'Submitted files'};
  const modelIds = {'codex-gpt56':'gpt','cc-opus5':'claude','kimi-k3':'kimi','qwen38-code':'qwen','gemini38-flash':'gemini','cc-deepseek':'deepseek','cc-glm':'glm'};
  const dialog = $('#replay-dialog'), body = $('#replay-body');
  const state = {case:null, model:null, tab:'trajectory', run:null, index:0, session:'all', filter:'all', query:'', speed:1.5, playing:false, autoplay:false, request:0, file:0, verdict:'failed', origin:null};
  let manifest, timer, frame;
  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cache = new Map();
  const brand = id => (window.PROFESSIONAL_BENCH?.models || []).find(m => m.id === modelIds[id]);
  const logo = id => brand(id)?.logo ? `<img src="${esc(brand(id).logo)}" alt="" aria-hidden="true">` : '';
  const selected = () => state.case.runs.find(r => r.model_id === state.model);
  const visible = () => (state.run?.events || []).filter(e =>
    (state.session === 'all' || e.session === state.session) &&
    (state.filter === 'all' ||
      (state.filter === 'tool' ? e.blocks.some(b => b.type === 'call') :
       state.filter === 'observation' ? e.blocks.some(b => b.type === 'observation') :
       state.filter === 'prompt' ? ['prompt','setup'].includes(e.kind) :
       e.kind === state.filter)) &&
    (!state.query || `${e.title} ${e.blocks.map(b => b.text || '').join(' ')}`.toLowerCase().includes(state.query.toLowerCase())));

  async function json(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Could not load recorded data (${response.status}).`);
    return response.json();
  }
  function stop() {
    clearTimeout(timer); cancelAnimationFrame(frame); state.playing = false; state.autoplay = false;
    dialog.classList.remove('replay-playing');
    const button = $('[data-action="play"]', body);
    if (button) {button.textContent = '▶ Play'; button.setAttribute('aria-pressed', 'false');}
    if ($('#replay-playback-status')) $('#replay-playback-status').textContent = 'Paused';
  }
  function setHash() {
    const hash = `#replay/${state.case.id}/${state.model}/${state.tab}/${state.index + 1}`;
    history.replaceState(null, '', hash);
  }
  function drawCards() {
    $('#replay-cards').innerHTML = manifest.cases.map((c, index) => {
      const scores = c.runs.map(r => r.score);
      return `<button type="button" class="replay-card replay-${c.id}" data-open-replay="${c.id}" aria-label="Start ${esc(c.title)} replay">
        <span class="replay-card-top"><span>${esc(c.domain)} / ${esc(c.task_id)}</span><span>0${index + 1}</span></span>
        <strong>${esc(c.title)}</strong><span class="replay-card-summary">${esc(c.summary)}</span>
        <span class="replay-spark" aria-label="Seven model scores">${c.runs.map(r => `<i style="--height:${Math.max(3,r.score)}%;--model-color:${brand(r.model_id)?.color || '#4c8190'}" title="${esc(r.model)}: ${score(r.score)}"></i>`).join('')}</span>
        <span class="replay-card-bottom"><span>7 recorded runs <small>Scores ${score(Math.min(...scores))}–${score(Math.max(...scores))}</small></span><span class="replay-start"><span aria-hidden="true">▶</span> Start</span></span>
      </button>`;
    }).join('');
  }
  function drawHeader() {
    dialog.classList.toggle('replay-dark', state.tab === 'trajectory');
    $('#replay-kicker').textContent = `${state.case.domain} · Task ${state.case.task_id} · Unified`;
    $('#replay-title').textContent = state.case.title;
    $('#replay-subtitle').textContent = state.case.summary;
    $('#replay-models').innerHTML = state.case.runs.map(r => `<button type="button" data-model-run="${r.model_id}" aria-pressed="${r.model_id === state.model}" style="--model-color:${brand(r.model_id)?.color || '#7a949f'}">${logo(r.model_id)}<span>${esc(r.model)}<small>${num(r.stats.events)} events</small></span><b>${score(r.score)}</b></button>`).join('');
    $$('[data-replay-tab]').forEach(b => {const on = b.dataset.replayTab === state.tab; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1;});
    body.setAttribute('aria-labelledby', 'replay-tab-' + state.tab);
  }
  async function openCase(id, model, tab = 'task', index = 0, autoplay = false) {
    const c = manifest.cases.find(c => c.id === id);
    if (!c) return;
    stop();
    if (!dialog.open) {state.origin = document.activeElement; dialog.showModal(); document.body.classList.add('replay-is-open');}
    Object.assign(state, {case:c, model:c.runs.some(r => r.model_id === model) ? model : c.default, tab:labels[tab] ? tab : 'trajectory', run:null, index:Math.max(0,index), session:'all', filter:'all', query:'', file:0, autoplay});
    drawHeader(); setHash();
    await loadRun();
  }
  async function loadRun() {
    const ticket = ++state.request, record = selected();
    body.innerHTML = `<div class="replay-loading" role="status"><span class="replay-loader"></span><h3>Opening ${esc(record.model)}…</h3><p>${num(record.stats.events)} recorded events · ${Math.ceil(record.bytes/1024)} KB</p></div>`;
    try {
      if (!cache.has(record.href)) cache.set(record.href, json(local(record.href)).catch(error => {cache.delete(record.href); throw error;}));
      const run = await cache.get(record.href);
      if (ticket !== state.request || !dialog.open) return;
      state.run = run; state.index = Math.min(state.index, run.events.length - 1); render();
      $('#replay-live').textContent = `${record.model} loaded`;
      if (state.autoplay) start();
    } catch (error) {
      if (ticket !== state.request || !dialog.open) return;
      body.innerHTML = `<div class="replay-loading"><h3>Could not open this run.</h3><p>${esc(error.message)}</p><button type="button" data-action="retry">Try again</button></div>`;
    }
  }
  function notes() {
    return (state.run.notes || []).map(n => `<p class="replay-notice">${esc(n)}</p>`).join('');
  }
  function taskView() {
    return `<div class="replay-task-grid"><aside><span class="replay-eyebrow">THE ASSIGNMENT</span><h3>${esc(state.case.title)}</h3><p>${esc(state.case.summary)}</p><h4>Required deliverables</h4><p>${esc(state.case.outputs)}</p><h4>Professional workflow</h4><p>${esc(state.case.focus)}</p><h4>Input materials</h4>${state.case.inputs.length ? `<ul>${state.case.inputs.map(i => `<li>${esc(i)}</li>`).join('')}</ul>` : '<p>The task is self-contained; no business attachments.</p>'}<p class="replay-small">The task text was matched to the archived user prompt for all seven runs.</p></aside><article><div class="replay-section-head"><h3>Full task</h3><span>Original language</span></div><pre class="replay-document" lang="zh">${esc(state.case.instruction)}</pre></article></div>`;
  }
  function trajectoryView() {
    const sessions = Object.entries(state.run.stats.sessions);
    return `${notes()}<div class="replay-player">
      <div class="replay-watch-bar"><span><i aria-hidden="true"></i><b id="replay-playback-status">Paused</b></span><span>Auto-scroll follows playback · Pause to read</span></div>
      <div class="replay-controls"><div><button type="button" data-action="restart" aria-label="Restart replay">↤</button><button type="button" data-action="previous" aria-label="Previous event">←</button><button type="button" class="replay-play" data-action="play" aria-pressed="false">▶ Play</button><button type="button" data-action="next" aria-label="Next event">→</button></div><span id="replay-counter"></span><label>Speed <select id="replay-speed" aria-label="Playback speed">${[0.5,1,1.5,2,4].map(n => `<option value="${n}" ${n === state.speed ? 'selected' : ''}>${n}×</option>`).join('')}</select></label><a href="${local(selected().href)}" download>Download run JSON ↓</a></div>
      <input id="replay-scrubber" type="range" min="0" value="0" max="1" aria-label="Replay position">
      <div class="replay-filters"><label>Session <select id="replay-session"><option value="all">All sessions (${num(state.run.stats.events)})</option>${sessions.map(([s,count]) => `<option value="${esc(s)}" ${s === state.session ? 'selected' : ''}>${esc(s)} (${num(count)})</option>`).join('')}</select></label><label>Show <select id="replay-filter">${[['all','All event types'],['tool','Tool calls'],['observation','Tool results'],['message','Assistant messages'],['prompt','Instructions']].map(([value,label]) => `<option value="${value}" ${value === state.filter ? 'selected' : ''}>${label}</option>`).join('')}</select></label><input id="replay-search" type="search" placeholder="Search messages, commands, results…" aria-label="Search trajectory" value="${esc(state.query)}"></div>
      <div class="replay-event-progress" aria-hidden="true"><span></span></div>
      <div class="replay-stage"><nav id="replay-events" aria-label="Recorded events"></nav><article id="replay-event-detail" tabindex="0"></article></div>
      <details class="replay-method"><summary>About this recording</summary><p>${esc(manifest.replay_note)}</p><p>Event counts follow the source format and are not comparable measures of model effort. Start opens playback at the selected speed (1.5× by default); shared links open paused. Events advance every 3 seconds at 1×, with extra reading time for long content. Scrolling or expanding the detail pauses playback. A tool error in the trace is distinct from an unmet grading criterion.</p><p>${state.run.sources.map(s => `${esc(s.session)}: <code>${esc(s.file)}</code>`).join('<br>')}</p></details>
    </div>`;
  }
  function drawList() {
    const events = visible();
    if (!events.some(e => e.id === state.run.events[state.index]?.id)) state.index = events.length ? events[0].id - 1 : 0;
    $('#replay-events').innerHTML = events.length ? events.map(e => `<button type="button" data-event="${e.id - 1}" aria-current="${e.id - 1 === state.index ? 'step' : 'false'}"><span class="replay-event-number">${num(e.id)}</span><span><strong>${esc(e.title)}</strong><small>${esc(e.session)} · ${esc(e.role)}</small>${e.preview ? `<span class="replay-event-preview">${esc(e.preview)}</span>` : ''}</span><i class="replay-event-dot ${e.kind}" aria-hidden="true"></i></button>`).join('') : '<p class="replay-small">No matching events. Clear the filters to see the full recording.</p>';
    drawEvent(false);
  }
  function drawEvent(scroll = true) {
    const events = visible(), event = state.run.events[state.index], position = events.findIndex(e => e.id === event?.id);
    const has = position >= 0;
    $('#replay-counter').textContent = has ? `${num(position + 1)} / ${num(events.length)} events` : '0 matching events';
    const slider = $('#replay-scrubber'); slider.max = Math.max(0,events.length - 1); slider.value = Math.max(0,position); slider.disabled = !has;
    $('[data-action="previous"]').disabled = position <= 0;
    $('[data-action="next"]').disabled = !has || position === events.length - 1;
    $('[data-action="play"]').disabled = !has || events.length < 2;
    $('[data-action="restart"]').disabled = !has;
    $$('[data-event]', body).forEach(b => b.setAttribute('aria-current', Number(b.dataset.event) === state.index ? 'step' : 'false'));
    if (!has) {$('#replay-event-detail').innerHTML = '<div class="replay-loading"><h3>No matching event</h3><p>Try a different search or session.</p></div>'; return;}
    const active = $(`[data-event="${state.index}"]`, body), list = $('#replay-events');
    if (active) {
      const top = list.scrollTop + active.getBoundingClientRect().top - list.getBoundingClientRect().top - (list.clientHeight - active.offsetHeight) / 2;
      list.scrollTo({top:Math.max(0,top), behavior:scroll && !reducedMotion() ? 'smooth' : 'instant'});
    }
    const names = {message:'Message', reasoning:'Recorded reasoning', call:'Tool call', observation:'Tool result'};
    $('#replay-event-detail').innerHTML = `<div class="replay-detail-head"><span class="replay-eyebrow">EVENT ${num(event.id)} / ${esc(event.session)}</span><span class="replay-kind">${esc(event.role)}</span><h3>${esc(event.title)}</h3><p>${esc(event.timestamp ? new Date(event.timestamp).toISOString().replace('T',' ').replace('.000Z',' UTC').replace('Z',' UTC') : 'Timestamp not recorded')}</p></div>${event.blocks.map((b,i) => {
      const text = b.text || '', long = text.length > 1800 || b.type === 'reasoning';
      const imageLinks = [...text.matchAll(/\[Recorded image: (cases\/media\/[a-f0-9]+\.(?:png|jpg|webp|gif))\]/g)].map(m => `<a href="${local(m[1])}" target="_blank" rel="noopener"><img class="replay-observation-image" src="${local(m[1])}" alt="Recorded image observation" loading="lazy"></a>`).join('');
      return `<section class="replay-block ${esc(b.type)}"><h4>${esc(names[b.type] || b.type)}${b.name ? ' · ' + esc(b.name) : ''}${b.error ? '<span class="replay-error-tag">tool error</span>' : ''}</h4>${long ? `<details ${b.type !== 'reasoning' && i === 0 ? 'open' : ''}><summary>${esc(text.replace(/\s+/g,' ').slice(0,140))}${text.length > 140 ? '…' : ''}<small>${num(text.length)} characters · expand full text</small></summary><pre>${esc(text)}</pre></details>` : `<pre>${esc(text)}</pre>`}${imageLinks}</section>`;
    }).join('')}<p class="replay-source">Source: ${esc(event.source)}</p>`;
    $('#replay-event-detail').scrollTop = 0;
    $('.replay-event-progress span').style.transform = 'scaleX(0)';
    setHash();
  }
  function resultsView() {
    const status = {unmet:'Unmet',triggered:'Triggered',met:'Met',clear:'Clear',unjudged:'Not judged',informational:'Informational'};
    const rows = state.run.rubric.filter(r => state.verdict === 'all' || ['unmet','triggered'].includes(r.status));
    return `<div class="replay-results"><div class="replay-section-head"><div><h3>Seven models. One task.</h3><p>Outcome Score / 100 · Select a model to inspect its grading and recorded work.</p></div></div><div class="replay-score-grid">${state.case.runs.map(r => `<button type="button" data-model-run="${r.model_id}" aria-pressed="${r.model_id === state.model}">${logo(r.model_id)}<span>${esc(r.model)}</span><b>${score(r.score)}</b><small>${r.failure_count} unmet / triggered criteria</small></button>`).join('')}</div><p class="replay-small">${esc(manifest.score_note)}</p>${notes()}<div class="replay-section-head"><div><h3>${esc(state.run.model)} · rubric verdicts</h3><p>Failure points below are the archived grader’s findings, not new root-cause diagnoses.</p></div><label>Show <select id="replay-verdict"><option value="failed" ${state.verdict === 'failed' ? 'selected' : ''}>Unmet / triggered (${state.run.failure_count})</option><option value="all" ${state.verdict === 'all' ? 'selected' : ''}>All criteria (${state.run.rubric.length})</option></select></label></div><div class="replay-rubrics">${rows.map(r => `<details class="replay-rubric ${r.status}" ${rows.length <= 3 ? 'open' : ''}><summary><span class="replay-rubric-id">R${esc(r.id)}</span><span>${esc(r.criterion)}</span><b>${esc(status[r.status])}<small>${r.hurdle ? 'Hurdle' : `Weight ${r.weight > 0 ? '+' : ''}${r.weight}`}</small></b></summary><div><h4>Archived judge explanation</h4><p lang="zh">${esc(r.reason || 'No explanation was retained.')}</p></div></details>`).join('') || '<p>No unmet or triggered criteria in this archived grading.</p>'}</div><p class="replay-small">Positive criteria are unmet when not hit. Penalties and hurdle conditions are shown as failures only when triggered; a clear zero-weight hurdle is not an error.</p></div>`;
  }
  function filesView() {
    if (!state.run.files.length) return `<div class="replay-empty-files"><span class="replay-eyebrow">SUBMITTED RESULT</span><h3>No final files in the archived output directory.</h3><p>The recorded Outcome Score is ${score(state.run.score)}. The trajectory remains available, including work performed before the run ended.</p><button type="button" data-show-tab="trajectory">Inspect the trajectory →</button></div>`;
    const file = state.run.files[Math.min(state.file, state.run.files.length - 1)];
    return `<div class="replay-files-grid"><nav aria-label="Submitted files">${state.run.files.map((f,i) => `<button type="button" data-file="${i}" aria-pressed="${f === file}"><span class="replay-file-type">${esc(f.format)}</span><strong>${esc(f.name)}</strong><small>${num(Math.ceil(f.bytes/1024))} KB</small></button>`).join('')}</nav><article><div class="replay-section-head"><div><h3>${esc(file.name)}</h3><p>${esc(file.preview_note)}</p></div><a class="replay-download" href="${local(file.href)}" download="${esc(file.name)}">Download original ↓</a></div><pre class="replay-document">${esc(file.preview || 'Preview unavailable; download the submitted file.')}</pre><details class="replay-method"><summary>File provenance</summary><p>Original submitted bytes · SHA-256</p><code>${esc(file.sha256)}</code></details></article></div>`;
  }
  function render() {
    drawHeader();
    if (!state.run) return;
    body.innerHTML = state.tab === 'task' ? taskView() : state.tab === 'trajectory' ? trajectoryView() : state.tab === 'results' ? resultsView() : filesView();
    body.scrollTop = 0;
    if (state.tab === 'trajectory') drawList();
    setHash();
  }
  function tab(value) {stop(); state.tab = value; render();}
  function advance(delta) {
    const events = visible(), position = events.findIndex(e => e.id - 1 === state.index);
    if (!events.length) return;
    state.index = events[Math.min(events.length-1,Math.max(0,position+delta))].id - 1; drawEvent();
  }
  function start() {
    state.autoplay = false;
    if (!state.run || state.tab !== 'trajectory' || !dialog.open || document.hidden) return;
    const events = visible();
    if (events.length < 2) return;
    if (state.index === events.at(-1).id - 1) {state.index = events[0].id - 1; drawEvent();}
    state.playing = true;
    dialog.classList.add('replay-playing');
    $('[data-action="play"]').textContent = 'Ⅱ Pause';
    $('[data-action="play"]').setAttribute('aria-pressed','true');
    $('#replay-playback-status').textContent = 'Playing';
    tick();
  }
  function tick() {
    clearTimeout(timer); cancelAnimationFrame(frame);
    if (!state.playing) return;
    const detail = $('#replay-event-detail'), progress = $('.replay-event-progress span');
    const startTop = detail.scrollTop, distance = Math.max(0, detail.scrollHeight - detail.clientHeight - startTop);
    const duration = (3000 + Math.min(12000, distance * 12)) / state.speed;
    const started = performance.now();
    function follow(now) {
      if (!state.playing) return;
      const fraction = Math.min(1, (now - started) / duration);
      progress.style.transform = `scaleX(${fraction})`;
      if (!reducedMotion()) detail.scrollTop = startTop + distance * Math.max(0, Math.min(1, (fraction - .18) / .72));
      if (fraction < 1) frame = requestAnimationFrame(follow);
    }
    frame = requestAnimationFrame(follow);
    timer = setTimeout(() => {
      if (!dialog.open || document.hidden || state.tab !== 'trajectory') {stop(); return;}
      const events = visible();
      if (!events.length || state.index === events.at(-1).id - 1) {stop(); $('#replay-live').textContent = 'Playback complete'; return;}
      advance(1); tick();
    }, duration);
  }
  dialog.addEventListener('click', async e => {
    const model = e.target.closest('[data-model-run]');
    if (model) {if (model.dataset.modelRun === state.model) return; stop(); state.model = model.dataset.modelRun; state.run = null; state.index = 0; state.session = 'all'; state.query = ''; state.file = 0; drawHeader(); setHash(); await loadRun(); return;}
    const t = e.target.closest('[data-replay-tab], [data-show-tab]');
    if (t) {tab(t.dataset.replayTab || t.dataset.showTab); return;}
    const ev = e.target.closest('[data-event]');
    if (ev) {stop(); state.index = Number(ev.dataset.event); drawEvent(false); return;}
    const file = e.target.closest('[data-file]');
    if (file) {state.file = Number(file.dataset.file); render(); return;}
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'retry') {await loadRun(); return;}
    if (!state.run) return;
    if (action === 'play') {
      if (state.playing) {stop(); return;}
      start();
    } else if (action === 'next' || action === 'previous') {stop(); advance(action === 'next' ? 1 : -1);}
    else if (action === 'restart') {stop(); const first = visible()[0]; if (first) {state.index = first.id - 1; drawEvent();}}
  });
  // Give the reader control as soon as they scroll or expand a recorded block.
  body.addEventListener('wheel', e => {if (e.target.closest('#replay-event-detail')) stop();}, {passive:true});
  body.addEventListener('touchstart', e => {if (e.target.closest('#replay-event-detail')) stop();}, {passive:true});
  body.addEventListener('click', e => {if (e.target.closest('#replay-event-detail summary')) stop();});
  dialog.addEventListener('change', e => {
    if (e.target.id === 'replay-speed') {state.speed = Number(e.target.value); if (state.playing) tick();}
    if (e.target.id === 'replay-session' || e.target.id === 'replay-filter') {stop(); state[e.target.id === 'replay-session' ? 'session' : 'filter'] = e.target.value; drawList();}
    if (e.target.id === 'replay-verdict') {state.verdict = e.target.value; render();}
  });
  dialog.addEventListener('input', e => {
    if (e.target.id === 'replay-scrubber') {stop(); const event = visible()[Number(e.target.value)]; if (event) {state.index = event.id - 1; drawEvent();}}
    if (e.target.id === 'replay-search') {stop(); state.query = e.target.value; drawList();}
  });
  $('#replay-tabs').addEventListener('keydown', e => {
    const tabs = $$('[data-replay-tab]');
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) return;
    e.preventDefault(); const i = tabs.indexOf(document.activeElement);
    const n = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    tabs[n].click(); tabs[n].focus();
  });
  dialog.addEventListener('keydown', e => {
    if (e.target.matches('input, select, textarea, button, summary, a') || state.tab !== 'trajectory' || !state.run) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {e.preventDefault(); stop(); advance(e.key === 'ArrowRight' ? 1 : -1);}
    if (e.key === ' ') {e.preventDefault(); $('[data-action="play"]')?.click();}
  });
  $('#replay-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {stop(); ++state.request; document.body.classList.remove('replay-is-open'); history.replaceState(null, '', '#replays'); state.origin?.focus();});
  dialog.addEventListener('click', e => {if (e.target === dialog) {const r = dialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close();}});
  document.addEventListener('visibilitychange', () => {if (document.hidden) stop();});
  $('#replay-link').addEventListener('click', async () => {setHash(); try {await navigator.clipboard.writeText(location.href); $('#replay-live').textContent = 'Replay link copied';} catch {$('#replay-live').textContent = 'Copy the link from the address bar';}});
  function fromHash() {
    const parts = location.hash.split('/');
    if (parts[0] === '#replay') openCase(parts[1], parts[2], parts[3], Math.max(0,(Number(parts[4]) || 1) - 1));
  }
  $('#replay-cards').addEventListener('click', e => {const b = e.target.closest('[data-open-replay]'); if (b) openCase(b.dataset.openReplay, undefined, 'trajectory', 0, true);});
  function initialize() {
    json('cases/manifest.json').then(data => {manifest = data; drawCards(); fromHash();}).catch(() => {
      $('#replay-cards').innerHTML = '<p>Case data could not be loaded. <button type="button" id="replay-init-retry">Try again</button> or <a href="cases/manifest.json">open the case index</a>.</p>';
      $('#replay-init-retry').addEventListener('click', initialize);
    });
  }
  window.addEventListener('hashchange', () => {if (manifest) fromHash();});
  initialize();
})();
