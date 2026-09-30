import { test } from 'node:test';
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
]) {
  globalThis[key] = key === 'window' ? browser : browser[key];
}
await import('../dist/sonoff-pool-card.js');
const Card = customElements.get('sonoff-outdoor-light-card');
const config = { type: 'custom:sonoff-outdoor-light-card', entity: 'switch.test_lights' };
const calls = [];
function hass(state = 'off') {
  return {
    states: { [config.entity]: { state, attributes: { friendly_name: 'Garden' } } },
    callService: async (...args) => {
      calls.push(args);
    },
  };
}
async function card(state = 'off', overrides = {}) {
  const el = new Card();
  el.setConfig({ ...config, ...overrides });
  el.hass = hass(state);
  document.body.append(el);
  await el.updateComplete;
  return el;
}

test('configuration validation', () => {
  const el = new Card();
  assert.throws(() => el.setConfig({}), /Потрібно вказати сутність/);
  assert.throws(() => el.setConfig({ entity: 123 }), /коректний entity_id/);
  assert.throws(() => el.setConfig({ ...config, name: 123 }), /Назва має бути рядком/);
});

test('renders name, state, entity and reacts to hass/config changes', async () => {
  const el = await card();
  assert.equal(el.shadowRoot.querySelector('h2').textContent, 'Garden');
  assert.equal(el.shadowRoot.querySelector('.state-badge'), null);
  assert.equal(el.shadowRoot.querySelector('.entity-id').textContent, config.entity);
  el.hass = hass('on');
  await el.updateComplete;
  assert.equal(el.shadowRoot.querySelector('.state-badge'), null);
  el.setConfig({ ...config, name: 'Outdoor lights' });
  await el.updateComplete;
  assert.equal(el.shadowRoot.querySelector('h2').textContent, 'Outdoor lights');
  el.hass = { ...hass(), states: { [config.entity]: { state: 'off', attributes: {} } } };
  el.setConfig(config);
  await el.updateComplete;
  assert.equal(el.shadowRoot.querySelector('h2').textContent, config.entity);
  el.remove();
});

test('toggle calls the correct switch service and waits for hass state', async () => {
  for (const [state, service] of [
    ['off', 'turn_on'],
    ['on', 'turn_off'],
  ]) {
    const el = await card(state);
    calls.length = 0;
    el.shadowRoot.querySelector('button').click();
    await el.updateComplete;
    assert.deepEqual(calls, [['switch', service, { entity_id: config.entity }]]);
    assert.equal(el.shadowRoot.querySelector('.state-badge'), null);
    el.remove();
  }
});

test('missing entity, wrong domain and loading produce readable errors', async () => {
  const el = await card();
  el.hass = { ...hass(), states: {} };
  await el.updateComplete;
  assert.match(el.shadowRoot.textContent, /Сутність не знайдено: switch.test_lights/);
  assert.equal(el.shadowRoot.querySelector('button'), null);
  el.setConfig({ ...config, entity: 'light.garden' });
  await el.updateComplete;
  assert.match(el.shadowRoot.textContent, /Ця картка підтримує лише сутності switch/);
  el.hass = undefined;
  await el.updateComplete;
  assert.match(el.shadowRoot.textContent, /Очікування Home Assistant/);
  el.remove();
});

test('unavailable and unknown states cannot call services', async () => {
  for (const state of ['unknown', 'unavailable']) {
    const el = await card(state);
    calls.length = 0;
    assert.equal(el.shadowRoot.querySelector('button').disabled, true);
    el.shadowRoot.querySelector('button').click();
    await el.updateComplete;
    assert.deepEqual(calls, []);
    assert.equal(el.shadowRoot.querySelector('.state-badge'), null);
    el.remove();
  }
});

test('pending requests block duplicate clicks and failed calls show an error', async () => {
  const el = await card();
  let reject;
  calls.length = 0;
  el.hass = {
    ...hass(),
    callService: (...args) => {
      calls.push(args);
      return new Promise((_, fail) => {
        reject = fail;
      });
    },
  };
  await el.updateComplete;
  const button = el.shadowRoot.querySelector('button');
  button.click();
  button.click();
  await el.updateComplete;
  assert.equal(calls.length, 1);
  assert.equal(button.getAttribute('aria-disabled'), 'true');
  reject(new Error('Connection failed'));
  await new Promise((resolve) => setTimeout(resolve, 0));
  await el.updateComplete;
  assert.match(el.shadowRoot.textContent, /Не вдалося перемкнути освітлення: Connection failed/);
  assert.equal(button.disabled, false);
  el.remove();
});

test('picker, stub config and visual editor integrate with Home Assistant', async () => {
  assert.equal(
    window.customCards.find((entry) => entry.type === 'sonoff-outdoor-light-card').name,
    'Освітлення подвір’я Sonoff',
  );
  assert.equal(Card.getStubConfig(hass()).entity, config.entity);
  assert.equal(Card.getStubConfig({ states: {} }).entity, '');
  const editor = await Card.getConfigElement();
  editor.hass = { ...hass(), states: { ...hass().states, 'light.other': { state: 'on', attributes: {} } } };
  editor.setConfig(config);
  document.body.append(editor);
  await editor.updateComplete;
  assert.equal(editor.shadowRoot.querySelectorAll('option').length, 2);
  assert.match(editor.shadowRoot.textContent, /Сутність перемикача \(обов’язково\)/);
  assert.equal(editor.shadowRoot.querySelector('option').textContent, 'Виберіть перемикач');
  assert.match(editor.shadowRoot.textContent, /Назва \(необов’язково\)/);
  let changed;
  editor.addEventListener('config-changed', (event) => {
    changed = event.detail.config;
  });
  const input = editor.shadowRoot.querySelector('input');
  input.value = 'Patio';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  assert.equal(changed.name, 'Patio');
  assert.equal(changed.entity, config.entity);
  input.value = '';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  assert.equal('name' in changed, false);
  editor.remove();
});

test('binary keyboard targets do not send redundant commands', async () => {
  const el = await card();
  const button = el.shadowRoot.querySelector('button');
  assert.equal(button.getAttribute('role'), 'switch');
  assert.equal(button.getAttribute('aria-checked'), 'false');
  calls.length = 0;
  button.dispatchEvent(new browser.KeyboardEvent('keydown', { key: 'ArrowLeft' }));
  assert.equal(calls.length, 0);
  button.dispatchEvent(new browser.KeyboardEvent('keydown', { key: 'ArrowRight' }));
  await el.updateComplete;
  assert.equal(calls[0][1], 'turn_on');
  assert.equal(button.getAttribute('aria-checked'), 'false');
  assert.equal(el.shadowRoot.querySelector('ha-card').classList.contains('is-on'), false);
  el.hass = hass('on');
  await el.updateComplete;
  assert.equal(button.getAttribute('aria-checked'), 'true');
  button.dispatchEvent(new browser.KeyboardEvent('keydown', { key: 'Home' }));
  await el.updateComplete;
  assert.equal(calls.at(-1)[1], 'turn_off');
  el.remove();
});

test('drag commits one binary command; cancellation commits nothing', async () => {
  const el = await card();
  const button = el.shadowRoot.querySelector('button');
  button.setPointerCapture = () => {};
  button.getBoundingClientRect = () => ({ left: 0, width: 300 });
  const pointer = (type, x) =>
    button.dispatchEvent(new browser.PointerEvent(type, { clientX: x, pointerId: 1, isPrimary: true, button: 0 }));
  calls.length = 0;
  pointer('pointerdown', 70);
  pointer('pointermove', 230);
  assert.equal(el.shadowRoot.querySelector('ha-card').classList.contains('is-on'), false);
  pointer('pointerup', 230);
  button.click();
  await el.updateComplete;
  assert.deepEqual(calls, [['switch', 'turn_on', { entity_id: config.entity }]]);
  calls.length = 0;
  pointer('pointerdown', 70);
  pointer('pointermove', 230);
  pointer('pointercancel', 230);
  assert.equal(calls.length, 0);
  el.remove();
});

test('pending scene stays truthful and a stale failure cannot affect a new entity', async () => {
  const el = await card();
  let reject;
  el.hass = {
    ...hass(),
    callService: () =>
      new Promise((_, fail) => {
        reject = fail;
      }),
  };
  await el.updateComplete;
  el.shadowRoot.querySelector('button').click();
  await el.updateComplete;
  assert.match(el.shadowRoot.querySelector('[role="status"]').textContent, /Надсилання команди/);
  assert.equal(el.shadowRoot.querySelector('button').getAttribute('aria-busy'), 'true');
  assert.equal(el.shadowRoot.querySelector('ha-card').classList.contains('is-on'), false);
  el.setConfig({ ...config, entity: 'switch.other' });
  el.hass = { ...hass(), states: { 'switch.other': { state: 'on', attributes: {} } } };
  reject(new Error('Old failure'));
  await new Promise((resolve) => setTimeout(resolve, 0));
  await el.updateComplete;
  assert.equal(el.shadowRoot.querySelector('[role="alert"]'), null);
  assert.equal(el.shadowRoot.querySelector('button').disabled, false);
  el.remove();
});
