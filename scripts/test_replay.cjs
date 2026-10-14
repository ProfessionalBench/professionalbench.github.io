const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {JSDOM, VirtualConsole} = require('jsdom');
const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'cases/manifest.json')));
const flush = () => new Promise(resolve => setImmediate(resolve));

async function harness(options = {}) {
  const errors = [], requests = [], timers = new Map();
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', e => errors.push(e));
  const dom = new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8'), {url:'https://professionalbench.github.io/' + (options.hash || ''), runScripts:'outside-only', pretendToBeVisual:true, virtualConsole});
  const w = dom.window;
  w.Element.prototype.scrollIntoView = function() {};
  w.HTMLDialogElement.prototype.showModal = function() {this.open = true;};
  w.HTMLDialogElement.prototype.close = function() {this.open = false; this.dispatchEvent(new w.Event('close'));};
  let sequence = 0;
  w.setTimeout = (callback, delay) => {const id = ++sequence; timers.set(id,{callback,delay}); return id;};
  w.clearTimeout = id => timers.delete(id);
  w.fetch = async url => {
    requests.push(url);
    if (options.fetch) {const value = await options.fetch(url); if (value) return value;}
    const filename = path.join(root,decodeURI(url));
    return {ok:fs.existsSync(filename), status:fs.existsSync(filename) ? 200 : 404, json:async () => {
      const data = JSON.parse(fs.readFileSync(filename));
      if (options.transform) options.transform(data, url);
      return data;
    }};
  };
  w.eval(fs.readFileSync(path.join(root,'data/benchmark-data.js'),'utf8'));
  w.eval(fs.readFileSync(path.join(root,'replay.js'),'utf8'));
  await flush();
  const $ = q => w.document.querySelector(q);
  const click = async q => {assert.ok($(q), q); $(q).click(); await flush();};
  const change = async (q,value,kind='change') => {$(q).value=value; $(q).dispatchEvent(new w.Event(kind,{bubbles:true})); await flush();};
  return {w,$,click,change,errors,requests,timers,close:() => dom.window.close(),tick:async () => {const [id,timer] = timers.entries().next().value; timers.delete(id); timer.callback(); await flush();}};
}

test('21 runs retain matching scores, valid evidence links and submitted file hashes', () => {
  const crypto = require('node:crypto');
  let runs = 0;
  for (const c of manifest.cases) {
    assert.equal(c.runs.length,7);
    for (const r of c.runs) {
      runs++;
      const data = JSON.parse(fs.readFileSync(path.join(root,r.href)));
      assert.equal(data.score,r.score);
      assert.equal(data.prompt_verified,true);
      assert.equal(data.events.length,r.stats.events);
      assert.equal(data.rubric.filter(x => ['unmet','triggered'].includes(x.status)).length,r.failure_count);
      assert.ok(data.rubric.filter(x => x.hurdle && !x.hit).every(x => x.status === 'clear'));
      assert.equal(data.events[0].id,1);
      assert.equal(data.events.at(-1).id,data.events.length);
      assert.ok(data.events.every(e => e.source && e.blocks.length));
      for (const f of data.files) assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f.href))).digest('hex'),f.sha256);
    }
  }
  assert.equal(runs,21);
  const finance = manifest.cases.find(c => c.id === 'finance');
  assert.equal(Object.keys(finance.runs.find(r => r.model_id === 'qwen38-code').stats.sessions).length,6);
  assert.equal(finance.runs.find(r => r.model_id === 'qwen38-code').file_count,0);
});

test('all case/model combinations open all four views without browser errors', async () => {
  const h = await harness();
  assert.equal(h.w.document.querySelectorAll('[data-open-replay]').length,3);
  for (const c of manifest.cases) {
    await h.click(`[data-open-replay="${c.id}"]`);
    for (const r of c.runs) {
      await h.click(`#replay-models [data-model-run="${r.model_id}"]`);
      for (const tab of ['task','trajectory','results','files']) {
        await h.click(`[data-replay-tab="${tab}"]`);
        assert.ok(h.$('#replay-body').textContent.length > 100);
        assert.equal(h.$('#replay-models [aria-pressed="true"]').dataset.modelRun,r.model_id);
        if (tab === 'trajectory') assert.equal(h.w.document.querySelectorAll('[data-event]').length,r.stats.events);
        if (tab === 'results') assert.equal(h.w.document.querySelectorAll('.replay-rubric').length,r.failure_count);
        if (tab === 'files') assert.equal(h.w.document.querySelectorAll('[data-file]').length,r.file_count);
      }
    }
    await h.click('#replay-close');
  }
  assert.equal(h.requests.filter(x => x.endsWith('/run.json')).length,21);
  assert.deepEqual(h.errors,[]);
  h.close();
});

test('playback speed, pause, end, restart, scrub and tab/close cleanup', async () => {
  const h = await harness({hash:'#replay/legal/codex-gpt56/trajectory/1'});
  await flush();
  assert.match(h.$('#replay-counter').textContent,/1 \/ 27/);
  await h.change('#replay-speed','4');
  await h.click('[data-action="play"]');
  assert.equal([...h.timers.values()][0].delay,750);
  await h.tick();
  assert.match(h.$('#replay-counter').textContent,/2 \/ 27/);
  await h.click('[data-action="play"]');
  assert.equal(h.timers.size,0);
  await h.change('#replay-scrubber','26','input');
  assert.equal(h.$('[data-action="next"]').disabled,true);
  await h.click('[data-action="play"]');
  assert.match(h.$('#replay-counter').textContent,/1 \/ 27/);
  await h.click('[data-replay-tab="results"]');
  assert.equal(h.timers.size,0);
  await h.click('[data-replay-tab="trajectory"]');
  await h.change('#replay-scrubber','25','input');
  await h.click('[data-action="play"]');
  await h.tick(); await h.tick();
  assert.equal(h.timers.size,0);
  assert.match(h.$('#replay-live').textContent,/complete/);
  await h.click('[data-action="restart"]');
  assert.match(h.$('#replay-counter').textContent,/1 \/ 27/);
  await h.click('[data-action="play"]');
  await h.click('#replay-close');
  assert.equal(h.timers.size,0);
  assert.equal(h.$('#replay-dialog').open,false);
  h.close();
});

test('native session filters, search, zero-result state and XSS escaping', async () => {
  const h = await harness({hash:'#replay/finance/qwen38-code/trajectory/1', transform:(data,url) => {
    if (url.includes('qwen38-code')) data.events[0].blocks[0].text += '<img src=x onerror="window.hacked=true">';
  }});
  await flush();
  assert.equal(h.w.document.querySelectorAll('#replay-event-detail img').length,0);
  await h.change('#replay-session','main');
  assert.equal(h.w.document.querySelectorAll('[data-event]').length,59);
  await h.change('#replay-search','no-such-event-123456','input');
  assert.equal(h.$('[data-action="play"]').disabled,true);
  assert.match(h.$('#replay-event-detail').textContent,/No matching/);
  await h.change('#replay-search','','input');
  assert.equal(h.$('[data-action="play"]').disabled,false);
  await h.click('[data-replay-tab="files"]');
  assert.match(h.$('#replay-body').textContent,/No final files/);
  await h.click('#replay-models [data-model-run="codex-gpt56"]');
  await h.click('[data-replay-tab="trajectory"]');
  await h.change('#replay-filter','observation');
  assert.ok(h.w.document.querySelectorAll('[data-event]').length > 0, 'structured events retain tool results inside tool-call steps');
  assert.ok(h.$('#replay-event-detail .observation'));
  assert.deepEqual(h.errors,[]);
  h.close();
});

test('stale requests cannot replace the currently selected model; failed fetch retries', async () => {
  let release, fail = true;
  const h = await harness({fetch:async url => {
    if (url === 'cases/legal/cc-opus5/run.json') await new Promise(resolve => {release = resolve;});
    if (url === 'cases/legal/cc-glm/run.json' && fail) {fail=false; return {ok:false,status:503};}
  }});
  await h.click('[data-open-replay="legal"]');
  await h.click('#replay-models [data-model-run="cc-opus5"]');
  await h.click('#replay-models [data-model-run="kimi-k3"]');
  release(); await flush();
  await h.click('[data-replay-tab="trajectory"]');
  assert.match(h.$('#replay-counter').textContent,/25 events/);
  await h.click('#replay-models [data-model-run="cc-glm"]');
  assert.match(h.$('#replay-body').textContent,/Could not open/);
  await h.click('[data-action="retry"]');
  assert.match(h.$('#replay-counter').textContent,/40 events/);
  assert.deepEqual(h.errors,[]);
  h.close();
});
