import { LitElement, html, svg, css } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { HomeAssistant, PoolCardConfig } from './types';
import './editor';

export class PoolCard extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;
  @state() private config?: PoolCardConfig;
  @state() private target?: 'on' | 'off';
  @state() private error = '';
  protected kind: 'light' | 'pump' = 'light';
  private version = 0;
  private timeout?: ReturnType<typeof setTimeout>;
  private frame?: number;
  private lastTime = 0;
  private scale = 1;
  private velocity = 0;
  private pressed = false;
  private angle = 0;
  private speed = 0;
  private wave = 0;
  private previousOn?: boolean;
  private gesture?: { id: number; x: number; y: number };
  private key?: string;
  private suppressClick = false;
  private motion?: MediaQueryList;
  private get isOn() {
    return this.entityState === 'on';
  }
  private get entityState() {
    return this.config && this.hass?.states[this.config.entity]?.state;
  }
  private get available() {
    return this.entityState === 'on' || this.entityState === 'off';
  }
  private get enabled() {
    return this.isConnected && this.available && !this.target;
  }
  private get cardTitle() {
    return this.config?.name || (this.kind === 'light' ? 'Підсвітка басейну' : 'Циркуляційний насос');
  }

  public setConfig(config: PoolCardConfig): void {
    if (!config?.entity) throw new Error('Потрібно вказати сутність');
    if (typeof config.entity !== 'string' || !/^switch\.[a-z0-9_]+$/.test(config.entity))
      throw new Error('Потрібна коректна сутність switch');
    if (config.name !== undefined && typeof config.name !== 'string') throw new Error('Назва має бути рядком');
    this.cleanup();
    this.config = { ...config };
    this.error = '';
    this.previousOn = undefined;
    this.angle = 0;
  }
  public getCardSize(): number {
    return 4;
  }
  public getGridOptions() {
    return { columns: 6, rows: 4, min_columns: 3, min_rows: 4 };
  }
  public connectedCallback(): void {
    super.connectedCallback();
    this.motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.motion.addEventListener('change', this.motionChanged);
    window.addEventListener('scroll', this.cancelGesture, true);
    window.addEventListener('blur', this.cancelGesture);
    this.requestUpdate();
  }
  public disconnectedCallback(): void {
    super.disconnectedCallback();
    this.cleanup();
    this.motion?.removeEventListener('change', this.motionChanged);
    window.removeEventListener('scroll', this.cancelGesture, true);
    window.removeEventListener('blur', this.cancelGesture);
  }
  private cleanup(): void {
    this.version++;
    clearTimeout(this.timeout);
    this.timeout = undefined;
    this.target = undefined;
    this.gesture = undefined;
    this.key = undefined;
    this.pressed = false;
    this.suppressClick = false;
    if (this.frame !== undefined) window.cancelAnimationFrame(this.frame);
    this.frame = undefined;
    this.lastTime = 0;
    this.scale = 1;
    this.velocity = this.speed = this.wave = 0;
  }
  private motionChanged = (): void => {
    if (this.frame !== undefined) window.cancelAnimationFrame(this.frame);
    this.frame = undefined;
    this.lastTime = 0;
    this.scale = 1;
    this.velocity = this.speed = this.wave = 0;
    this.paint();
    this.startAnimation();
  };
  protected updated(): void {
    if (this.target && !this.available) this.finish('Немає зв’язку');
    else if (this.target && this.target === this.entityState) this.finish();
    if (this.previousOn === false && this.isOn && this.kind === 'light') this.wave = 0.001;
    this.previousOn = this.isOn;
    this.paint();
    this.startAnimation();
  }
  private finish(error = ''): void {
    clearTimeout(this.timeout);
    this.timeout = undefined;
    this.version++;
    this.target = undefined;
    this.error = error;
  }
  private async toggle(): Promise<void> {
    if (!this.enabled || !this.config || !this.hass) return;
    this.target = this.isOn ? 'off' : 'on';
    this.error = '';
    const version = ++this.version;
    this.timeout = setTimeout(() => {
      if (version === this.version) this.finish('Немає підтвердження. Спробуйте ще раз.');
    }, 10000);
    try {
      await this.hass.callService('switch', this.target === 'on' ? 'turn_on' : 'turn_off', {
        entity_id: this.config.entity,
      });
      // A resolved service promise is not a device-state confirmation.
    } catch {
      if (version === this.version) this.finish('Не вдалося виконати команду. Спробуйте ще раз.');
    }
  }
  private press(value: boolean): void {
    this.pressed = value;
    this.startAnimation();
  }
  private cancelGesture = (): void => {
    this.gesture = undefined;
    this.key = undefined;
    this.press(false);
  };
  private pointerDown(event: PointerEvent): void {
    if (!this.enabled || !event.isPrimary || event.button !== 0) return;
    this.suppressClick = true;
    this.gesture = { id: event.pointerId, x: event.clientX, y: event.clientY };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.press(true);
  }
  private pointerMove(event: PointerEvent): void {
    if (
      this.gesture?.id === event.pointerId &&
      Math.hypot(event.clientX - this.gesture.x, event.clientY - this.gesture.y) > 10
    )
      this.cancelGesture();
  }
  private pointerUp(event: PointerEvent): void {
    if (this.gesture?.id !== event.pointerId) return;
    const button = event.currentTarget as HTMLElement;
    const bounds = button.getBoundingClientRect();
    const inside =
      event.clientX >= bounds.left &&
      event.clientX <= bounds.right &&
      event.clientY >= bounds.top &&
      event.clientY <= bounds.bottom;
    this.cancelGesture();
    if (button.hasPointerCapture(event.pointerId)) button.releasePointerCapture(event.pointerId);
    if (inside) void this.toggle();
  }
  private onClick(event: MouseEvent): void {
    // Pointer commands commit on validated release; detail=0 supports assistive activation.
    if (event.detail > 0 || this.suppressClick) {
      this.suppressClick = false;
      return;
    }
    void this.toggle();
  }
  private keyDown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    if (!this.enabled || event.repeat) return;
    this.suppressClick = false;
    this.key = event.key;
    this.press(true);
  }
  private keyUp(event: KeyboardEvent): void {
    if (event.key !== this.key) return;
    event.preventDefault();
    this.cancelGesture();
    void this.toggle();
  }
  private startAnimation(): void {
    if (!this.isConnected || this.motion?.matches || this.frame !== undefined) return;
    this.frame = window.requestAnimationFrame(this.tick);
  }
  private tick = (time: number): void => {
    this.frame = undefined;
    const dt = Math.min((time - (this.lastTime || time - 16)) / 1000, 0.032);
    this.lastTime = time;
    const goal = this.pressed ? 0.945 : 1;
    // Semi-implicit damped spring; retargeting preserves velocity.
    this.velocity += ((goal - this.scale) * 440 - this.velocity * 27) * dt;
    this.scale += this.velocity * dt;
    const rotationGoal = this.kind === 'pump' && this.isOn ? 48 : 0;
    this.speed += (rotationGoal - this.speed) * (1 - Math.exp(-dt * 3));
    if (!rotationGoal && this.speed < 0.02) this.speed = 0;
    this.angle = (this.angle + this.speed * dt) % 360;
    if (this.wave > 0) {
      this.wave += dt / 0.85;
      if (this.wave >= 1) this.wave = 0;
    }
    this.paint();
    if (
      Math.abs(goal - this.scale) > 0.0001 ||
      Math.abs(this.velocity) > 0.001 ||
      this.speed > 0 ||
      rotationGoal ||
      this.wave
    )
      this.startAnimation();
    else this.lastTime = 0;
  };
  private paint(): void {
    const moving = this.renderRoot.querySelector<SVGElement>('.press-part');
    if (moving) moving.style.transform = `scale(${this.motion?.matches ? 1 : this.scale})`;
    const rotor = this.renderRoot.querySelector<SVGElement>('.rotor');
    if (rotor) rotor.style.transform = `rotate(${this.angle}deg)`;
    const wave = this.renderRoot.querySelector<SVGElement>('.wave');
    if (wave) {
      wave.style.opacity = this.wave && !this.motion?.matches ? String((1 - this.wave) * 0.45) : '0';
      wave.style.transform = `scale(${1 + this.wave * 0.4})`;
    }
  }
  private power() {
    return svg`<path class="power" d="M140 108v16m-10-12a17 17 0 1 0 20 0"/>`;
  }
  private drawing() {
    return svg`<svg viewBox="0 0 280 240" aria-hidden="true">
      ${
        this.kind === 'light'
          ? svg`
        <circle class="halo" cx="140" cy="120" r="101"/>
        <circle class="wave" cx="140" cy="120" r="88"/>
        <circle class="housing" cx="140" cy="120" r="83"/>
        <g class="press-part"><circle class="diffuser" cx="140" cy="120" r="70"/>${this.power()}</g>
      `
          : svg`
        <path class="housing pipe" d="M16 104h51v32H16zM213 104h51v32h-51z"/>
        <circle class="housing" cx="140" cy="120" r="83"/>
        <circle class="chamber" cx="140" cy="120" r="70"/>
        <g class="rotor">${[0, 90, 180, 270].map((angle) => svg`<path class="blade" transform="rotate(${angle} 140 120)" d="M134 105C104 98 101 73 121 63Q147 52 158 75L147 106Z"/>`)}</g>
        <g class="press-part"><circle class="hub" cx="140" cy="120" r="30"/>${this.power()}</g>
      `
      }
    </svg>`;
  }
  protected render() {
    if (!this.config) return html``;
    const message = !this.hass
      ? 'Очікування Home Assistant…'
      : !this.entityState
        ? 'Сутність не знайдено'
        : !this.available
          ? 'Немає зв’язку'
          : this.error ||
            (this.target
              ? this.kind === 'light'
                ? this.target === 'on'
                  ? 'Вмикаємо…'
                  : 'Вимикаємо…'
                : this.target === 'on'
                  ? 'Запускаємо…'
                  : 'Зупиняємо…'
              : this.kind === 'light'
                ? 'Натисніть на світильник'
                : 'Натисніть на насос');
    return html`<ha-card
      class="${this.kind} ${this.isOn ? 'is-on' : ''} ${this.target ? 'pending' : ''} ${this.available ? '' : 'unavailable'}"
    >
      <h2>${this.cardTitle}</h2>
      <button
        type="button"
        role="switch"
        aria-label=${this.cardTitle}
        aria-checked=${String(this.isOn)}
        aria-busy=${String(!!this.target)}
        aria-disabled=${String(!this.available || !!this.target)}
        aria-describedby="status"
        ?disabled=${!this.available}
        @click=${this.onClick}
        @pointerdown=${this.pointerDown}
        @pointermove=${this.pointerMove}
        @pointerup=${this.pointerUp}
        @pointercancel=${this.cancelGesture}
        @lostpointercapture=${this.cancelGesture}
        @keydown=${this.keyDown}
        @keyup=${this.keyUp}
        @blur=${this.cancelGesture}
      >
        ${this.drawing()}
      </button>
      <p id="status" role=${this.error ? 'alert' : 'status'} aria-live="polite">
        ${this.target ? html`<span class="spinner" aria-hidden="true"></span>` : ''}${message}
      </p>
    </ha-card>`;
  }
  static styles = css`
    :host {
      display: block;
      min-width: 0;
    }
    ha-card {
      --accent: #56bfb9;
      display: flex;
      flex-direction: column;
      align-items: center;
      box-sizing: border-box;
      padding: 24px 16px 20px;
      height: 344px;
      background: var(--ha-card-background, var(--card-background-color, #fff));
      color: var(--primary-text-color, #263b40);
      border: var(--ha-card-border-width, 1px) solid var(--ha-card-border-color, var(--divider-color, #dce5e5));
      border-radius: var(--ha-card-border-radius, 18px);
      box-shadow: none;
    }
    .pump {
      --accent: #6eaed2;
    }
    h2 {
      font: 500 18px/24px var(--ha-font-family, system-ui, sans-serif);
      margin: 0;
      text-align: center;
      max-width: 100%;
      overflow-wrap: anywhere;
    }
    button {
      border: 0;
      background: none;
      padding: 0;
      margin: auto 0;
      width: 100%;
      max-width: 280px;
      height: 240px;
      flex-shrink: 1;
      min-height: 0;
      color: inherit;
      cursor: pointer;
      touch-action: pan-y;
      -webkit-tap-highlight-color: transparent;
      border-radius: 50%;
    }
    button:focus-visible {
      outline: 3px solid var(--primary-color, #239aab);
      outline-offset: 0;
    }
    button:disabled {
      cursor: default;
    }
    button[aria-busy='true'] {
      cursor: progress;
    }
    svg {
      width: 100%;
      height: 100%;
      overflow: visible;
    }
    .housing {
      fill: var(--card-background-color, #fff);
      stroke: var(--divider-color, #d1dede);
      stroke-width: 3;
    }
    .diffuser,
    .chamber,
    .hub {
      fill: var(--secondary-background-color, #edf2f2);
    }
    .diffuser {
      transition: fill 0.25s;
    }
    .halo {
      fill: var(--accent);
      opacity: 0;
      transition: opacity 0.25s;
    }
    .is-on .halo {
      opacity: 0.13;
    }
    .light.is-on .diffuser {
      fill: #b8eee7;
    }
    .power {
      fill: none;
      stroke: var(--secondary-text-color, #6a7f84);
      stroke-width: 2.5;
      stroke-linecap: round;
    }
    .light.is-on .power {
      stroke: #327a76;
    }
    .blade {
      fill: var(--secondary-text-color, #80979c);
      opacity: 0.55;
    }
    .pump.is-on .blade {
      fill: var(--accent);
      opacity: 1;
    }
    .hub {
      stroke: var(--divider-color, #d1dede);
      stroke-width: 2;
    }
    .pump.is-on .hub {
      stroke: var(--accent);
    }
    .press-part,
    .rotor,
    .wave {
      transform-origin: 140px 120px;
    }
    .wave {
      fill: none;
      stroke: var(--accent);
      stroke-width: 2;
      opacity: 0;
    }
    .unavailable svg {
      opacity: 0.35;
    }
    p {
      margin: 0;
      min-height: 20px;
      font: 400 13px/20px var(--ha-font-family, system-ui, sans-serif);
      color: var(--secondary-text-color, #63777b);
      text-align: center;
    }
    p[role='alert'] {
      color: var(--error-color, #bf4545);
    }
    .spinner {
      display: inline-block;
      width: 9px;
      height: 9px;
      border: 2px solid var(--divider-color, #d1dede);
      border-top-color: var(--accent);
      border-radius: 50%;
      margin-right: 8px;
      vertical-align: -1px;
      animation: spin 1s linear infinite;
    }
    .light.pending .diffuser {
      animation: pulse 1.2s ease-in-out infinite;
    }
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
    @keyframes pulse {
      50% {
        opacity: 0.48;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      *,
      *::before,
      *::after {
        animation: none !important;
        transition: none !important;
      }
      .pending .diffuser {
        stroke: var(--accent);
        stroke-width: 3;
      }
    }
  `;
}

for (const kind of ['light', 'pump'] as const) {
  const type = `sonoff-pool-${kind}-card`;
  customElements.define(
    type,
    class extends PoolCard {
      protected kind = kind;
      static getConfigElement(): HTMLElement {
        return document.createElement(`${type}-editor`);
      }
      static getStubConfig(hass?: HomeAssistant): PoolCardConfig {
        return {
          type: `custom:${type}`,
          entity: Object.keys(hass?.states ?? {}).find((id) => id.startsWith('switch.')) ?? '',
        };
      }
    },
  );
  window.customCards ??= [];
  window.customCards.push({
    type,
    name: kind === 'light' ? 'Підсвітка басейну' : 'Циркуляційний насос',
    description: kind === 'light' ? 'Керування підсвіткою басейну' : 'Керування каналом циркуляційного насоса',
    preview: true,
  });
}
