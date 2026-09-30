# Changelog

## 0.2.0

- Replace the outdoor-light scaffold with two independent pool cards: `sonoff-pool-light-card` and `sonoff-pool-pump-card`.
- Add a visual editor for each card, with required `entity` and optional `name`.
- Add Ukrainian UI, light and dark theme support, keyboard and touch controls, and reduced-motion support.
- Add a spring-driven lamp diffuser and pump hub, a confirmation ripple, and continuous pump acceleration and deceleration.
- Wait for Home Assistant state confirmation, block duplicate commands, and handle service failures, missing entities and a 10-second confirmation timeout.
- Cancel gestures on scroll, movement and outside release; clean up timers and animations on removal or reconfiguration.
- Package both cards in the HACS release asset `sonoff-pool-card.js`.

### Migration

The scaffold's proposed `pump_entity` / `light_entity` configuration is replaced by one `entity` per card. Replace any copied `custom:sonoff-outdoor-light-card` instance from this scaffold with the appropriate pool card type. The original outdoor-light project can remain installed separately.

### Validation

TypeScript, ESLint, Rollup and eight automated tests pass. Browser checks cover both themes, four states, desktop and mobile layouts, keyboard input, touch scrolling, outside release and reduced motion. Tests use simulated Home Assistant entities; physical relay testing is not included.
