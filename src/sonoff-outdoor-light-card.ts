import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { HomeAssistant, SonoffOutdoorLightCardConfig } from './types';

@customElement('sonoff-outdoor-light-card')
export class SonoffOutdoorLightCard extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;
  @state() private config?: SonoffOutdoorLightCardConfig;
  @state() private pending = false;
  @state() private serviceError = '';

  @state() private dragPosition: number | undefined;
  private gesture?: { id: number; start: number; moved: boolean };
  private suppressClick = false;
  private commandVersion = 0;

  public setConfig(config: SonoffOutdoorLightCardConfig): void {
    if (!config?.entity) throw new Error('Потрібно вказати сутність');
    if (typeof config.entity !== 'string' || !/^[a-z_]+\.[a-z0-9_]+$/.test(config.entity)) {
      throw new Error('Сутність повинна мати коректний entity_id');
    }
    if (config.name !== undefined && typeof config.name !== 'string') throw new Error('Назва має бути рядком');
    this.commandVersion++;
    this.pending = false;
    this.dragPosition = undefined;
    this.gesture = undefined;
    this.config = { ...config };
    this.serviceError = '';
  }

  public static async getConfigElement(): Promise<HTMLElement> {
    await import('./editor');
    return document.createElement('sonoff-outdoor-light-card-editor');
  }

  public static getStubConfig(hass?: HomeAssistant): SonoffOutdoorLightCardConfig {
    return {
      type: 'custom:sonoff-outdoor-light-card',
      entity: Object.keys(hass?.states ?? {}).find((id) => id.startsWith('switch.')) ?? '',
    };
  }

  public getCardSize(): number {
    return 10;
  }

  protected render() {
    if (!this.config) return html``;
    if (!this.hass) return this.renderError('Очікування Home Assistant...');
    if (this.config.entity.split('.')[0] !== 'switch') {
      return this.renderError('Ця картка підтримує лише сутності switch');
    }
    const entity = this.hass.states[this.config.entity];
    if (!entity) return this.renderError(`Сутність не знайдено: ${this.config.entity}`);
    const isOn = entity.state === 'on';
    const available = isOn || entity.state === 'off';
    const name = this.config.name || entity.attributes.friendly_name || this.config.entity;
    return html`
      <ha-card class=${`${isOn ? 'is-on' : ''} ${available ? '' : 'unavailable'}`}>
        <div class="scene" aria-hidden="true">
          ${this.renderScene()}
          <div class="scene-caption"><span class="scene-dot"></span> ОСВІТЛЕННЯ ПОДВІР’Я</div>
          <span class="scene-note">${isOn ? 'Трохи світла. Тепліша ніч.' : 'Мить спокою після заходу сонця.'}</span>
        </div>
        <div class="content">
          <div class="heading">
            <div class="identity">
              <h2>${name}</h2>
              <div class="entity-id">${this.config.entity}</div>
            </div>
          </div>
          <button
            type="button"
            class="power-switch"
            role="switch"
            aria-checked=${isOn ? 'true' : 'false'}
            aria-label=${`${name}: увімкнути або вимкнути`}
            aria-describedby="control-help"
            aria-busy=${this.pending ? 'true' : 'false'}
            aria-disabled=${!available || this.pending ? 'true' : 'false'}
            ?disabled=${!available}
            style=${`--position: ${this.dragPosition ?? (isOn ? 1 : 0)};`}
            @click=${this.onClick}
            @keydown=${this.onKeyDown}
            @pointerdown=${this.onPointerDown}
            @pointermove=${this.onPointerMove}
            @pointerup=${this.onPointerUp}
            @pointercancel=${this.cancelGesture}
            @lostpointercapture=${this.cancelGesture}
          >
            <span class="track-label off-label">ВИМК.</span><span class="track-label on-label">УВІМК.</span>
            <span class="thumb ${this.dragPosition === undefined ? '' : 'dragging'}">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v9m-5-7a8 8 0 1 0 10 0" /></svg>
              <span class="grip"></span>
            </span>
          </button>
          <div class="control-footer" id="control-help" role="status" aria-live="polite">
            <span class="feedback"
              >${this.pending ? html`<span class="pending-dot"></span>Надсилання команди...` : !available ? 'Немає зв’язку — керування недоступне' : 'Посуньте або натисніть'}</span
            >
            <span class="binary-label">${this.pending ? 'ЗАЧЕКАЙТЕ' : 'ВИМК. / УВІМК.'}</span>
          </div>
          ${this.serviceError ? html`<p class="error" role="alert">${this.serviceError}</p>` : ''}
        </div>
      </ha-card>
    `;
  }

  private renderScene() {
    return html`<svg class="yard" viewBox="0 0 480 270" preserveAspectRatio="xMidYMid slice">
      <defs>
        <filter id="soft-beam" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.5" />
        </filter>
        <linearGradient id="sky" x2="0" y2="1">
          <stop stop-color="#101d2c" />
          <stop offset="1" stop-color="#263a40" />
        </linearGradient>
        <linearGradient id="ground" x2="0" y2="1">
          <stop stop-color="#1d302f" />
          <stop offset="1" stop-color="#111c24" />
        </linearGradient>
        <linearGradient id="metal">
          <stop stop-color="#101a20" />
          <stop offset=".48" stop-color="#435257" />
          <stop offset=".62" stop-color="#263338" />
          <stop offset="1" stop-color="#10191e" />
        </linearGradient>
        <linearGradient id="beam" x1="0" y1="0" x2="0" y2="1">
          <stop stop-color="#ffe6a0" stop-opacity=".38" />
          <stop offset="1" stop-color="#f9d68c" stop-opacity="0" />
        </linearGradient>
        <radialGradient id="pool">
          <stop stop-color="#ffe1a0" stop-opacity=".42" />
          <stop offset=".55" stop-color="#efd18b" stop-opacity=".16" />
          <stop offset="1" stop-color="#f8da91" stop-opacity="0" />
        </radialGradient>
        <radialGradient id="halo">
          <stop stop-color="#ffe8b0" stop-opacity=".65" />
          <stop offset=".3" stop-color="#ffe2a0" stop-opacity=".18" />
          <stop offset="1" stop-color="#ffe1a0" stop-opacity="0" />
        </radialGradient>
      </defs>
      <path fill="url(#sky)" d="M0 0h480v270H0z" />
      <g fill="#b9cad2" opacity=".45">
        <circle cx="73" cy="64" r=".8" />
        <circle cx="174" cy="38" r=".7" />
        <circle cx="281" cy="57" r="1" />
        <circle cx="423" cy="83" r=".8" />
        <circle cx="337" cy="30" r=".6" />
        <circle cx="112" cy="107" r=".6" />
      </g>
      <circle cx="377" cy="58" r="19" fill="#c5d7d6" opacity=".025" />
      <circle cx="377" cy="58" r="11" fill="#c5d7d6" opacity=".045" />
      <path d="M380 51a8 8 0 1 0 5 12 9 9 0 0 1-5-12" fill="#cedbd7" opacity=".7" />
      <path d="M0 174Q58 151 122 176T264 169T480 174V270H0" fill="#172a2c" />
      <g fill="#102326">
        <path
          d="M27 82 0 139h16L0 171h25v30h6v-30h30l-22-32h15zM89 113 64 163h14l-21 25h29v19h5v-19h27l-19-25h13zM428 87l-27 60h14l-25 36h35v22h6v-22h35l-25-36h14zM468 119l-22 43h12l-20 29h28v22h5v-22h27l-19-29h13z"
        />
      </g>
      <path d="M0 201Q104 189 226 202T480 196V270H0" fill="url(#ground)" />
      <g fill="none" stroke="#62726a" stroke-opacity=".12">
        <path d="m0 230 480-9M0 257l480-14M106 211l-48 59m126-61-20 61m123-63 25 63m64-65 62 65" />
      </g>
      <g class="illumination">
        <ellipse cx="244" cy="223" rx="162" ry="45" fill="url(#pool)" />
        <path d="m216 113-96 129h247l-96-129" fill="url(#beam)" filter="url(#soft-beam)" />
        <ellipse cx="244" cy="118" rx="76" ry="66" fill="url(#halo)" />
      </g>
      <ellipse cx="244" cy="232" rx="34" ry="5" fill="#080f16" opacity=".5" />
      <path d="M235 123h17v105h-17z" fill="url(#metal)" />
      <path d="M228 227h31l4 6h-39z" fill="url(#metal)" />
      <path d="M211 105h65l-6 19h-53z" fill="#0c171e" stroke="#53615f" stroke-width=".7" />
      <path class="lamp-glass" d="M217 111h53l-3 8h-47z" fill="#667365" />
      <path d="m206 104 9-9h57l9 9v4h-75z" fill="url(#metal)" />
      <path d="M217 96h52" stroke="#84908a" stroke-opacity=".5" />
      <path d="m48 225-4-9m4 9 5-13m-5 13 9-5m337 14-5-10m5 10 3-16m0 16 7-8" stroke="#3c5145" fill="none" />
    </svg>`;
  }

  private onClick(): void {
    if (this.suppressClick) {
      this.suppressClick = false;
      return;
    }
    void this.toggle();
  }

  private onKeyDown(event: KeyboardEvent): void {
    const targets: Record<string, boolean> = {
      ArrowRight: true,
      ArrowUp: true,
      End: true,
      ArrowLeft: false,
      ArrowDown: false,
      Home: false,
    };
    if (event.key in targets) {
      event.preventDefault();
      void this.toggle(targets[event.key]);
    }
  }

  private onPointerDown(event: PointerEvent): void {
    if (event.button !== 0 || !event.isPrimary || this.pending) return;
    this.suppressClick = false;
    this.gesture = { id: event.pointerId, start: event.clientX, moved: false };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  private onPointerMove(event: PointerEvent): void {
    if (!this.gesture || this.gesture.id !== event.pointerId) return;
    if (Math.abs(event.clientX - this.gesture.start) > 6) this.gesture.moved = true;
    if (!this.gesture.moved) return;
    const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.dragPosition = Math.max(
      0,
      Math.min(1, (event.clientX - bounds.left - bounds.width * 0.25) / (bounds.width * 0.5)),
    );
  }

  private onPointerUp(event: PointerEvent): void {
    if (!this.gesture || this.gesture.id !== event.pointerId) return;
    const moved = this.gesture.moved;
    const target = (this.dragPosition ?? 0) >= 0.5;
    this.cancelGesture();
    if (moved) {
      this.suppressClick = true;
      void this.toggle(target);
    }
  }

  private cancelGesture(): void {
    this.gesture = undefined;
    this.dragPosition = undefined;
  }

  private renderError(message: string) {
    return html`<ha-card><p class="content error" role="alert">${message}</p></ha-card>`;
  }

  private async toggle(target?: boolean): Promise<void> {
    if (!this.hass || !this.config || this.pending || !this.config.entity.startsWith('switch.')) return;
    const entity = this.hass.states[this.config.entity];
    if (!entity || (entity.state !== 'on' && entity.state !== 'off')) return;
    const turnOn = target ?? entity.state !== 'on';
    if (turnOn === (entity.state === 'on')) return;
    const version = this.commandVersion;
    this.pending = true;
    this.serviceError = '';
    try {
      await this.hass.callService('switch', turnOn ? 'turn_on' : 'turn_off', {
        entity_id: this.config.entity,
      });
    } catch (error) {
      if (version !== this.commandVersion) return;
      this.serviceError = `Не вдалося перемкнути освітлення: ${error instanceof Error ? error.message : String(error)}`;
    } finally {
      if (version === this.commandVersion) this.pending = false;
    }
  }

  static styles = css`
    :host {
      display: block;
      min-width: 0;
    }
    ha-card {
      display: block;
      overflow: hidden;
      border-radius: var(--ha-card-border-radius, 24px);
      background: var(--ha-card-background, var(--card-background-color, #18232b));
      color: var(--primary-text-color, #edf1ed);
      border: 1px solid var(--divider-color, #34414a);
      box-shadow: var(--ha-card-box-shadow, 0 12px 32px #0003);
    }
    .scene {
      position: relative;
      height: 252px;
      overflow: hidden;
      background: #14232e;
    }
    .yard {
      display: block;
      width: 100%;
      height: 100%;
    }
    .scene-caption {
      position: absolute;
      top: 23px;
      left: 24px;
      font-size: 9px;
      letter-spacing: 2.4px;
      font-weight: 600;
      color: #c3cfce;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .scene-dot {
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: #b6c8c7;
    }
    .scene-note {
      position: absolute;
      bottom: 17px;
      left: 24px;
      color: #a8b9bb;
      font-size: 11px;
      letter-spacing: 0.2px;
    }
    .illumination {
      opacity: 0;
      transition: opacity 850ms ease;
    }
    .is-on .illumination {
      opacity: 1;
    }
    .lamp-glass {
      transition: fill 550ms ease;
    }
    .is-on .lamp-glass {
      fill: #fff0be;
    }
    .content {
      padding: 23px 24px 18px;
    }
    .heading {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      justify-content: space-between;
      margin-bottom: 24px;
    }
    .identity {
      min-width: 0;
    }
    h2 {
      margin: 0;
      font-size: 22px;
      font-weight: 500;
      line-height: 1.25;
      letter-spacing: -0.5px;
      overflow-wrap: anywhere;
    }
    .entity-id {
      margin-top: 7px;
      font-size: 11px;
      line-height: 1.5;
      color: var(--secondary-text-color, #9eabb5);
      overflow-wrap: anywhere;
    }
    .power-switch {
      display: block;
      position: relative;
      width: 100%;
      height: 76px;
      padding: 0;
      border: 1px solid #39454c;
      border-radius: 17px;
      background: linear-gradient(180deg, #0a1219, #162129);
      box-shadow:
        inset 0 3px 8px #0008,
        0 1px 0 #ffffff0b;
      cursor: pointer;
      touch-action: pan-y;
      user-select: none;
      font: inherit;
      -webkit-tap-highlight-color: transparent;
    }
    .track-label {
      position: absolute;
      top: 50%;
      transform: translate(-50%, -50%);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 3px;
      color: #a5b3ba;
    }
    .off-label {
      left: 25%;
    }
    .on-label {
      left: 75%;
    }
    .thumb {
      position: absolute;
      top: 6px;
      bottom: 6px;
      left: 6px;
      width: calc(50% - 6px);
      transform: translateX(calc(var(--position) * 100%));
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 17px;
      border-radius: 12px;
      background: linear-gradient(150deg, #48565f, #2c3943);
      box-shadow:
        inset 0 1px 0 #ffffff30,
        0 3px 7px #0009;
      transition:
        transform 360ms cubic-bezier(0.2, 0.8, 0.2, 1),
        background 400ms;
    }
    .thumb svg {
      width: 23px;
      height: 23px;
      fill: none;
      stroke: #e0e6e5;
      stroke-width: 1.7;
      stroke-linecap: round;
    }
    .grip {
      height: 15px;
      width: 9px;
      border-left: 1px solid #ffffff25;
      border-right: 1px solid #ffffff25;
    }
    .is-on .thumb {
      background: linear-gradient(145deg, #f3deb0, #c3a36c);
      box-shadow:
        inset 0 1px 0 #fff6,
        0 3px 7px #0009,
        0 0 18px #eccb8512;
    }
    .is-on .thumb svg {
      stroke: #4a3b25;
    }
    .is-on .grip {
      border-color: #4a3b2540;
    }
    .thumb.dragging {
      transition: none;
    }
    .power-switch:focus-visible {
      outline: 3px solid var(--primary-color, #a4d8ed);
      outline-offset: 4px;
    }
    .power-switch:disabled,
    .power-switch[aria-disabled='true'] {
      cursor: default;
    }
    .unavailable .power-switch {
      opacity: 0.45;
    }
    .control-footer {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      margin-top: 13px;
      min-height: 18px;
      align-items: center;
      color: var(--secondary-text-color, #9eabb5);
      font-size: 10px;
      line-height: 1.5;
    }
    .feedback {
      display: flex;
      align-items: center;
      gap: 7px;
    }
    .binary-label {
      font-size: 8px;
      letter-spacing: 1.5px;
      white-space: nowrap;
    }
    .pending-dot {
      flex-shrink: 0;
      width: 10px;
      height: 10px;
      border: 2px solid #a6b7c144;
      border-top-color: var(--primary-color, #efce8b);
      border-radius: 50%;
      animation: sending 800ms linear infinite;
    }
    .error {
      color: var(--error-color, #ef9e97);
      font-size: 13px;
      line-height: 1.5;
      overflow-wrap: anywhere;
    }
    @keyframes sending {
      to {
        transform: rotate(360deg);
      }
    }
    @media (max-width: 380px) {
      .content {
        padding: 20px 18px 16px;
      }
      .scene {
        height: 225px;
      }
      .scene-caption,
      .scene-note {
        left: 18px;
      }
      h2 {
        font-size: 20px;
      }
      .heading {
        gap: 8px;
      }
      .binary-label {
        display: none;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      *,
      *::before,
      *::after {
        transition: none !important;
        animation: none !important;
      }
    }
  `;
}

window.customCards = window.customCards || [];
if (!window.customCards.some((card) => card.type === 'sonoff-outdoor-light-card')) {
  window.customCards.push({
    type: 'sonoff-outdoor-light-card',
    name: 'Освітлення подвір’я Sonoff',
    description: 'Керування освітленням подвір’я через наявну сутність switch у Home Assistant.',
    preview: true,
  });
}
