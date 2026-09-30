# Sonoff Pool Card

Initial project scaffold for one Home Assistant dashboard card controlling a pool pump and pool light through the two `switch` entities of the same Sonoff relay.

## Planned entity configuration

The future card will accept two `switch` entity IDs per card instance, through YAML or the visual editor. No device or entity ID will be hardcoded into the bundle. For the Home Assistant instance shown in the screenshots, the planned configuration would be:

```yaml
type: custom:sonoff-pool-card
pump_entity: switch.basein_sonoff_100102c164_1
light_entity: switch.basein_sonoff_100102c164_2
```

In another Home Assistant instance, replace both values with that instance's switch entity IDs. The `pump_entity` and `light_entity` options and the new card type are **not implemented yet**; this is the intended configuration for the later card work.

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
