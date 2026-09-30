import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
const browser = new Window();
for (const key of [
  'window',
  'document',
  'customElements',
  'HTMLElement',
  'Element',
  'Document',
  'DocumentFragment',
  'ShadowRoot',
  'CSSStyleSheet',
  'CustomEvent',
  'Event',
  'Node',
])
  globalThis[key] = key === 'window' ? browser : browser[key];
await import('../dist/sonoff-pool-card.js');
after(() => browser.happyDOM.abort());
const calls = [];
function hass(
  light = 'off',
  pump = 'off',
  service = async (...args) => {
    calls.push(args);
  },
) {
  return {
    states: { 'switch.light': { state: light, attributes: {} }, 'switch.pump': { state: pump, attributes: {} } },
    callService: service,
  };
}
async function card(kind = 'light', state = hass()) {
  const el = document.createElement(`sonoff-pool-${kind}-card`);
  el.setConfig({ entity: `switch.${kind}` });
  el.hass = state;
  document.body.append(el);
  await el.updateComplete;
  return el;
}
const button = (el) => el.shadowRoot.querySelector('button');
test('both cards reserve full section width and enough rows for the footer', async () => {
  for (const kind of ['light', 'pump']) {
    const el = await card(kind);
    assert.deepEqual(el.getGridOptions(), { columns: 'full', rows: 6, min_rows: 6 });
    assert.equal(el.getCardSize(), 8);
    assert.match(el.shadowRoot.querySelector('#status').textContent, /Натисніть/);
    el.remove();
  }
});
const flush = async (el) => {
  await Promise.resolve();
  await el.updateComplete;
};
const pointer = (el, type, x = 100, y = 100) =>
  button(el).dispatchEvent(
    new browser.PointerEvent(type, { pointerId: 1, isPrimary: true, button: 0, clientX: x, clientY: y }),
  );
function geometry(el) {
  button(el).setPointerCapture = () => {};
  button(el).hasPointerCapture = () => false;
  button(el).getBoundingClientRect = () => ({ left: 0, right: 280, top: 0, bottom: 240 });
}

test('two picker entries and editors, validation and Ukrainian defaults', async () => {
  assert.equal(window.customCards.length, 2);
  assert.equal(customElements.get('sonoff-outdoor-light-card'), undefined);
  for (const kind of ['light', 'pump']) {
    const el = await card(kind);
    const C = el.constructor;
    assert.throws(() => el.setConfig({}), /сутність/);
    assert.throws(() => el.setConfig({ entity: 'light.foo' }), /switch/);
    assert.throws(() => el.setConfig({ entity: 'switch.foo', name: 12 }), /рядком/);
    assert.equal(C.getStubConfig(hass()).entity, 'switch.light');
    const ed = C.getConfigElement();
    ed.hass = hass();
    ed.setConfig({ entity: `switch.${kind}`, type: `custom:sonoff-pool-${kind}-card` });
    document.body.append(ed);
    await ed.updateComplete;
    let changed;
    ed.addEventListener('config-changed', (e) => (changed = e.detail.config));
    const input = ed.shadowRoot.querySelector('input');
    input.value = 'Назва';
    input.dispatchEvent(new Event('input'));
    assert.equal(changed.name, 'Назва');
    assert.equal(changed.entity, `switch.${kind}`);
    assert.equal(ed.shadowRoot.querySelectorAll('option').length, 3);
    ed.remove();
    el.remove();
  }
});
test('channels are independent; service completion waits for real state and blocks repeats', async () => {
  const light = await card(),
    pump = await card('pump');
  calls.length = 0;
  button(light).click();
  button(light).click();
  await flush(light);
  assert.deepEqual(calls, [['switch', 'turn_on', { entity_id: 'switch.light' }]]);
  assert.equal(button(light).getAttribute('aria-checked'), 'false');
  assert.equal(button(light).getAttribute('aria-busy'), 'true');
  assert.equal(button(pump).getAttribute('aria-busy'), 'false');
  light.hass = hass('on');
  await flush(light);
  assert.equal(button(light).getAttribute('aria-busy'), 'false');
  button(pump).click();
  await flush(pump);
  assert.equal(calls.at(-1)[2].entity_id, 'switch.pump');
  button(light).click();
  await flush(light);
  assert.equal(calls.at(-1)[1], 'turn_off');
  light.remove();
  pump.remove();
});
test('errors, missing entities, unknown and unavailable states', async () => {
  const el = await card(
    'light',
    hass('off', 'off', async () => {
      throw Error('backend secret');
    }),
  );
  button(el).click();
  await flush(el);
  assert.match(el.shadowRoot.textContent, /Не вдалося виконати команду/);
  assert.equal(button(el).getAttribute('aria-busy'), 'false');
  for (const state of ['unavailable', 'unknown']) {
    el.hass = hass(state);
    await flush(el);
    assert.equal(button(el).disabled, true);
    assert.match(el.shadowRoot.textContent, /Немає зв’язку/);
  }
  el.hass = { ...hass(), states: {} };
  await flush(el);
  assert.match(el.shadowRoot.textContent, /Сутність не знайдено/);
  assert.equal(button(el).disabled, true);
  el.remove();
});
test('confirmation timeout and stale service failures cannot affect a reconfigured card', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let reject;
  const el = await card(
    'light',
    hass('off', 'off', () => new Promise((_, r) => (reject = r))),
  );
  button(el).click();
  await flush(el);
  t.mock.timers.tick(10001);
  await flush(el);
  assert.match(el.shadowRoot.textContent, /Немає підтвердження/);
  assert.equal(button(el).getAttribute('aria-busy'), 'false');
  el.setConfig({ entity: 'switch.pump' });
  reject(Error('old'));
  await flush(el);
  assert.equal(el.shadowRoot.querySelector('[role=alert]'), null);
  el.remove();
  t.mock.timers.reset();
});
test('pointer release, cancellation, scrolling, movement and outside release', async () => {
  for (const cancel of ['pointercancel', 'lostpointercapture', 'scroll', 'move', 'outside', 'valid']) {
    const el = await card();
    geometry(el);
    calls.length = 0;
    pointer(el, 'pointerdown');
    assert.equal(el.pressed, true);
    if (cancel === 'scroll') window.dispatchEvent(new Event('scroll'));
    else if (cancel === 'move') pointer(el, 'pointermove', 130);
    else if (cancel === 'pointercancel' || cancel === 'lostpointercapture') pointer(el, cancel);
    pointer(el, 'pointerup', cancel === 'outside' ? 300 : 100);
    button(el).dispatchEvent(new browser.MouseEvent('click', { detail: 1 }));
    await flush(el);
    assert.equal(calls.length, cancel === 'valid' ? 1 : 0, cancel);
    assert.equal(el.pressed, false);
    el.remove();
  }
});
test('Enter and Space, autorepeat and lost focus', async () => {
  for (const key of ['Enter', ' ']) {
    const el = await card();
    calls.length = 0;
    button(el).dispatchEvent(new browser.KeyboardEvent('keydown', { key }));
    assert.equal(el.pressed, true);
    button(el).dispatchEvent(new browser.KeyboardEvent('keydown', { key, repeat: true }));
    assert.equal(calls.length, 0);
    button(el).dispatchEvent(new browser.KeyboardEvent('keyup', { key }));
    await flush(el);
    assert.equal(calls.length, 1);
    el.remove();
  }
  const el = await card();
  calls.length = 0;
  button(el).dispatchEvent(new browser.KeyboardEvent('keydown', { key: ' ' }));
  button(el).dispatchEvent(new Event('blur'));
  button(el).dispatchEvent(new browser.KeyboardEvent('keyup', { key: ' ' }));
  assert.equal(calls.length, 0);
  el.remove();
});
test('spring preserves velocity, rotor coasts without resetting, cleanup and reduced motion', async () => {
  const el = await card('pump', hass('off', 'on'));
  window.cancelAnimationFrame(el.frame);
  el.frame = undefined;
  el.tick(100);
  const initial = el.angle;
  assert.ok(el.speed > 0);
  el.hass = hass();
  await flush(el);
  window.cancelAnimationFrame(el.frame);
  el.frame = undefined;
  el.tick(116);
  assert.ok(el.angle > initial);
  assert.ok(el.speed > 0);
  el.velocity = 0.1;
  el.press(true);
  assert.equal(el.velocity, 0.1);
  el.setConfig({ entity: 'switch.light' });
  assert.equal(el.frame, undefined);
  assert.equal(el.speed, 0);
  assert.equal(el.velocity, 0);
  el.motion = { matches: true, removeEventListener() {} };
  await flush(el);
  el.motionChanged();
  assert.equal(el.frame, undefined);
  el.remove();
  assert.equal(el.timeout, undefined);
  assert.equal(el.frame, undefined);
});

test('removal cancels a pending deadline and invalidates late rejection', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let reject;
  const el = await card(
    'light',
    hass(
      'off',
      'off',
      () =>
        new Promise((_, fail) => {
          reject = fail;
        }),
    ),
  );
  button(el).click();
  await flush(el);
  el.remove();
  assert.equal(el.timeout, undefined);
  assert.equal(el.frame, undefined);
  reject(new Error('late failure'));
  t.mock.timers.tick(11000);
  await flush(el);
  document.body.append(el);
  await flush(el);
  assert.equal(button(el).getAttribute('aria-busy'), 'false');
  assert.equal(el.shadowRoot.querySelector('[role=alert]'), null);
  el.remove();
  t.mock.timers.reset();
});
