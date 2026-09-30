# Sonoff Pool Card — Dev Container

The optional VS Code Dev Container uses the shared Home Assistant development image `ghcr.io/custom-cards/custom-card-devcontainer:latest` as a tool dependency.

Open this project using **Dev Containers: Reopen in Container**. Setup installs dependencies with npm; startup launches Home Assistant and the Rollup watch server.

```sh
npm install
npm run build
npm test
npm start
```

- Home Assistant: http://localhost:8123 (development user/password: dev/dev).
- Card module: http://localhost:5000/dist/sonoff-pool-card.js.
- Main source: `src/sonoff-pool-card.ts`.
- Bundle: `dist/sonoff-pool-card.js`.
- Container workspace: `/workspaces/sonoff-pool-card`.

For dashboard installation and YAML configuration, see the project README.
