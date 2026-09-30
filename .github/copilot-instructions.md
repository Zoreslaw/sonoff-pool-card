# Project instructions

This project is sonoff-pool-card, two Home Assistant dashboard cards for the two switch entities of one Sonoff pool relay.

- Write all user-facing UI text in Ukrainian, including card labels, statuses, error messages, and visual editor text.
- Write documentation and code comments in English. Preserve Home Assistant API values. Never hardcode device or entity IDs.
- The bundle entry point is `src/sonoff-pool-card.ts`; configuration types are in `src/types.ts`.
- When implementing the pool card, register unique card and editor identifiers so it can coexist with the outdoor light card.
- Each light or pump card requires one `entity` switch ID and accepts an optional `name`; keep both visual editors aligned.
- Use TypeScript, Lit and Rollup, with strict typing.
- Use hass.states and hass.callService for existing switch entities.
- Use Home Assistant theme variables and accessible controls.
- Handle missing entities, unsupported domains, unavailable states and service errors.
- Keep the implementation small. No direct device APIs or backend.
- Install with npm install; check with npm run build and npm test.
- Update README when configuration or installation changes.
