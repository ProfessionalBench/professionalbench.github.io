const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {JSDOM, VirtualConsole} = require('jsdom');
const root = path.resolve(__dirname, '..');

function harness(t, options = {}) {
  const errors = [], timers = new Map(), frames = new Map(), media = new Map();
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', e => errors.push(e));
  const dom = new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8'), {
    url:'https://professionalbench.github.io/', runScripts:'outside-only', pretendToBeVisual:true, virtualConsole
  });
  const w = dom.window, $ = q => w.document.querySelector(q);
  t.after(() => {assert.deepEqual(errors,[]); w.close();});
  w.matchMedia = query => {
    const listeners = [];
    const result = {matches:query.includes('reduced-motion') ? !!options.reduced : !!options.compact,
      addEventListener:(_,cb) => listeners.push(cb),
      change(matches) {this.matches=matches; listeners.forEach(cb=>cb());}};
    media.set(query,result); return result;
  };
  let observer, sequence = 0;
  w.IntersectionObserver = class {constructor(callback) {observer=callback;} observe() {}};
  w.setTimeout = (callback,delay) => {const id=++sequence; timers.set(id,{callback,delay}); return id;};
  w.clearTimeout = id => timers.delete(id);
  w.requestAnimationFrame = callback => {const id=++sequence; frames.set(id,callback); return id;};
  w.cancelAnimationFrame = id => frames.delete(id);
  w.DOMPoint = class {constructor(x,y) {this.x=x; this.y=y;} matrixTransform() {return this;}};
  $('#bubble-chart').getScreenCTM = () => ({inverse:()=>({})});
  w.eval(fs.readFileSync(path.join(root,'data/benchmark-data.js'),'utf8'));
  w.PROFESSIONAL_CASES = [];
  w.eval(fs.readFileSync(path.join(root,'experience.js'),'utf8'));
  const pointer = (selector,type,properties={}) => {
    const event = new w.Event(type,{bubbles:!['pointerenter','pointerleave'].includes(type)});
    Object.assign(event,{pointerType:'mouse',...properties}); $(selector).dispatchEvent(event);
  };
  const near = id => {
    const orb = $(`.bubble-node[data-model="${id}"] .bubble-orb`);
    pointer('#bubble-chart','pointermove',{clientX:+orb.getAttribute('cx'),clientY:+orb.getAttribute('cy')});
    for(const [id,callback] of [...frames]) {frames.delete(id); callback();}
  };
  return {w,$,timers,media,pointer,near,models:w.PROFESSIONAL_BENCH.models,
    active:() => $('.bubble-node.is-active').dataset.model,
    visible:value => observer([{isIntersecting:value,intersectionRatio:value ? 1 : 0}]),
    hidden:value => {Object.defineProperty(w.document,'hidden',{value,configurable:true}); w.document.dispatchEvent(new w.Event('visibilitychange'));},
    tick:() => {assert.equal(timers.size,1); const [id,timer]=timers.entries().next().value; assert.equal(timer.delay,3500); timers.delete(id); timer.callback();}
  };
}

test('visible idle chart tours all seven models in order, with one timer and synchronized details', t => {
  const h=harness(t);
  assert.equal(h.timers.size,0);
  h.visible(true);
  for(let index=0;index<=7;index++) {
    const model=h.models[index%7];
    assert.equal(h.active(),model.id);
    assert.equal(h.$('#model-inspector h3').textContent,model.name);
    assert.equal(h.$('#bubble-legend [aria-pressed="true"]').dataset.selectModel,model.id);
    assert.equal(h.$('#bubble-nodes').lastElementChild.dataset.model,model.id);
    h.tick();
  }
  h.visible(false); assert.equal(h.timers.size,0);
  h.visible(true); assert.equal(h.timers.size,1);
  h.hidden(true); assert.equal(h.timers.size,0);
  h.hidden(false); assert.equal(h.timers.size,1);
});

test('pointer proximity overrides autoplay and previous clicks; leaving resumes from the selection', t => {
  const h=harness(t); h.visible(true);
  h.pointer('.efficiency-card','pointerenter');
  assert.equal(h.timers.size,0);
  h.near('gemini'); assert.equal(h.active(),'gemini');
  h.$('.bubble-node[data-model="gpt"]').dispatchEvent(new h.w.MouseEvent('click',{bubbles:true}));
  assert.equal(h.active(),'gpt');
  h.near('qwen'); assert.equal(h.active(),'qwen');
  h.pointer('[data-select-model="deepseek"]','pointerover');
  assert.equal(h.active(),'deepseek');
  assert.match(h.$('#bubble-tour-state').textContent,/Your selection/);
  h.pointer('.efficiency-card','pointerleave'); h.tick();
  assert.equal(h.active(),'glm');
});

test('keyboard selection preserves focus and arrow order while pausing the tour', t => {
  const h=harness(t); h.visible(true);
  const qwen=h.$('.bubble-node[data-model="qwen"]');
  qwen.focus();
  assert.equal(h.w.document.activeElement,qwen);
  assert.equal(h.active(),'qwen'); assert.equal(h.timers.size,0);
  qwen.dispatchEvent(new h.w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
  assert.equal(h.w.document.activeElement.dataset.model,'kimi');
  assert.equal(h.active(),'kimi'); assert.equal(h.timers.size,0);
  h.$('.bubble-node[data-model="kimi"]').dispatchEvent(new h.w.KeyboardEvent('keydown',{key:'Home',bubbles:true}));
  assert.equal(h.w.document.activeElement.dataset.model,'gpt');
  h.$('a').focus(); assert.equal(h.timers.size,1);
});

test('explicit pause, reduced motion and touch selection stay paused until resumed', t => {
  const h=harness(t,{reduced:true}); h.visible(true);
  assert.equal(h.timers.size,0);
  h.$('#bubble-tour-toggle').click(); assert.equal(h.timers.size,1);
  h.pointer('.efficiency-card','pointerdown',{pointerType:'touch'});
  assert.equal(h.timers.size,0);
  h.$('[data-select-model="claude"]').click(); assert.equal(h.active(),'claude');
  h.pointer('.efficiency-card','pointerleave');
  h.$('[data-eff-domain="finance"]').click(); assert.equal(h.timers.size,0);
  h.$('#bubble-tour-toggle').click(); h.tick(); assert.equal(h.active(),'gemini');
  h.$('#bubble-tour-toggle').click();
  h.pointer('.efficiency-card','pointerenter'); h.pointer('.efficiency-card','pointerleave');
  assert.equal(h.timers.size,0);
  h.$('#bubble-tour-toggle').click();
  h.media.get('(prefers-reduced-motion: reduce)').change(true);
  assert.equal(h.timers.size,0);
});

test('larger circles keep area proportional to cost across domains and selection on desktop and mobile', t => {
  for(const compact of [false,true]) {
    const h=harness(t,{compact});
    for(const domain of ['overall','finance','legal','healthcare']) {
      h.$(`[data-eff-domain="${domain}"]`).click();
      for(const model of h.models) {
        const orb=h.$(`.bubble-node[data-model="${model.id}"] .bubble-orb`);
        const before=['r','cx','cy'].map(key=>orb.getAttribute(key));
        const radius=+before[0], factor=26*(compact ? .52 : 1);
        assert.ok(Math.abs(radius*radius/model.results[domain].cost-factor*factor)<1e-8);
        h.$(`[data-select-model="${model.id}"]`).click();
        assert.deepEqual(['r','cx','cy'].map(key=>orb.getAttribute(key)),before);
      }
    }
  }
});
