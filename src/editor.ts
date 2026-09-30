import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { HomeAssistant, SonoffOutdoorLightCardConfig } from './types';

@customElement('sonoff-outdoor-light-card-editor')
export class SonoffOutdoorLightCardEditor extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;
  @state() private config?: SonoffOutdoorLightCardConfig;

  public setConfig(config: SonoffOutdoorLightCardConfig): void {
    this.config = { ...config };
  }

  protected render() {
    if (!this.config) return html``;
    return html`
      <label
        >Сутність перемикача (обов’язково)
        <select .value=${this.config.entity} @change=${this.entityChanged}>
          <option value="">Виберіть перемикач</option>
          ${
            this.config.entity && !this.hass?.states[this.config.entity]
              ? html`<option value=${this.config.entity}>${this.config.entity}</option>`
              : ''
          }
          ${Object.keys(this.hass?.states ?? {})
            .filter((id) => id.startsWith('switch.'))
            .sort()
            .map((id) => html`<option value=${id} ?selected=${id === this.config?.entity}>${id}</option>`)}
        </select>
      </label>
      <label
        >Назва (необов’язково)
        <input .value=${this.config.name ?? ''} @input=${this.nameChanged} />
      </label>
    `;
  }

  private entityChanged(event: Event): void {
    this.updateConfig({ entity: (event.target as HTMLSelectElement).value });
  }

  private nameChanged(event: Event): void {
    this.updateConfig({ name: (event.target as HTMLInputElement).value });
  }

  private updateConfig(change: Partial<SonoffOutdoorLightCardConfig>): void {
    if (!this.config) return;
    this.config = { ...this.config, ...change };
    if (!this.config.name) delete this.config.name;
    this.dispatchEvent(
      new CustomEvent('config-changed', {
        detail: { config: this.config },
        bubbles: true,
        composed: true,
      }),
    );
  }

  static styles = css`
    label {
      display: block;
      margin-bottom: 16px;
      color: var(--primary-text-color);
    }
    input,
    select {
      display: block;
      box-sizing: border-box;
      width: 100%;
      margin-top: 8px;
      padding: 12px;
      border: 1px solid var(--divider-color);
      border-radius: 8px;
      background: var(--card-background-color);
      color: var(--primary-text-color);
      font: inherit;
    }
  `;
}
