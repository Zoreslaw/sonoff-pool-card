# Sonoff Pool Card

Initial project scaffold for one Home Assistant dashboard card controlling a pool pump and pool light through the two `switch` entities of the same Sonoff relay.

## Relay entities

- Circulation pump: `switch.basein_sonoff_100102c164_1`
- Pool light: `switch.basein_sonoff_100102c164_2`

These are the entity IDs shown in Home Assistant. The future card should use Home Assistant's existing switch services for each channel. The planned configuration keys are `pump_entity` and `light_entity`; they are **not implemented yet**.

## Current status

Only the project setup has been prepared. The card implementation, visual editor, previews, and custom element identifiers still represent the unchanged outdoor light card. The source file is `src/sonoff-outdoor-light-card.ts`. Do not install this bundle alongside the original card until the pool card receives its own identifiers and two-entity implementation.

## Project setup

- Package and intended GitHub repository: `Zoreslaw/sonoff-pool-card`.
- HACS title: **Sonoff Pool Card**.
- Build output and release asset: `dist/sonoff-pool-card.js`.
- Initial version: `0.1.0`. No release tag has been created.

```sh
npm ci
npm run build
npm test
```

The build and test commands currently check the copied outdoor light implementation. Do not publish a release or add the bundle to Home Assistant until the card source, example configuration, and tests have been adapted for both relay channels.

## License

MIT; see LICENSE. Existing copyright notices are preserved.
