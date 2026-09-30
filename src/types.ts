export interface SonoffOutdoorLightCardConfig {
  type: string;
  entity: string;
  name?: string;
}
export interface HomeAssistant {
  states: Record<string, { state: string; attributes: { friendly_name?: string } }>;
  callService(domain: string, service: string, data: { entity_id: string }): Promise<unknown>;
}
declare global {
  interface Window {
    customCards?: Array<{ type: string; name: string; description: string; preview?: boolean }>;
  }
}
