# Project instructions

This project is sonoff-pool-card, a Home Assistant dashboard card for the two switch entities of one Sonoff pool relay.

- Write all user-facing UI text in Ukrainian, including card labels, statuses, error messages, and visual editor text.
- Write documentation and code comments in English. Preserve Home Assistant API values. Never hardcode device or entity IDs.
- During initial setup, leave `src/` unchanged. The copied main file remains `src/sonoff-outdoor-light-card.ts`; configuration types are in `src/types.ts`.
- When implementing the pool card, register unique card and editor identifiers so it can coexist with the outdoor light card.
- The intended pool configuration accepts separate `pump_entity` and `light_entity` switch IDs per card instance; keep the card and visual editor aligned.
- Use TypeScript, Lit and Rollup, with strict typing.
- Use hass.states and hass.callService for existing switch entities.
- Use Home Assistant theme variables and accessible controls.
- Handle missing entities, unsupported domains, unavailable states and service errors.
- Keep the implementation small. No direct device APIs or backend.
- Install with npm install; check with npm run build and npm test.
- Update README when configuration or installation changes.
