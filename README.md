# Asset Studio

Local-first web editor for game assets, starting with ZERO//DAY infrastructure graphics.

## Scope
Browser only, local processing, manual AI collaboration. No remote uploads, API, backend, desktop runtime or authentication in V0.

## Getting started
Requires Node.js 22.12+ (22 LTS recommended) and npm.
```sh
npm install
npm run dev
```
Open the address printed by Vite (normally http://localhost:5173).

```sh
npm run typecheck
npm run test
npm run build
```
Until package-lock.json is generated and committed, use npm install; afterwards use npm ci.

## Documentation
- [Product](docs/PRODUCT.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Roadmap](docs/ROADMAP.md)
- [AI handoff contract](docs/AI_HANDOFF.md)
- [Current work and validation](docs/STATUS.md)
- [Contributor instructions](AGENTS.md)

Do not commit private reference images, generated assets or local projects. License not yet selected.
