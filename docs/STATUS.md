# Status

## M0 — final validation in progress

Confirmed on user workstation at e2920ff: Node 24.18.0, Vitest 5.1.0, npm audit 0 vulnerabilities, typecheck PASS, 5/5 unit tests PASS, Vite production build PASS. The browser screenshot confirms PNG import and display of a 1254 × 1254 asset. The dependency lockfile is committed.

This revision adds baseline GitHub Actions checks, ESLint configuration and two Chromium smoke scenarios (synthetic PNG with transparency, zoom/pan/reset, file replacement, drag/drop and invalid inputs). They are written but not executed in the remote authoring environment. Browser and lint dependencies are not yet in package-lock.json and must be installed locally; see below. CI currently runs audit, typecheck, unit tests and build only. Once verified, extend CI to lint and Chromium.

## Local validation
```sh
npm install -D --save-exact @playwright/test eslint @eslint/js typescript-eslint eslint-plugin-react-hooks
npm pkg set 'scripts.lint=eslint src tests vite.config.ts playwright.config.ts' 'scripts.test:e2e=playwright test'
npx playwright install chromium
npm audit
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
```
If Chromium lacks Linux system libraries, install required system dependencies with `npx playwright install-deps chromium`. Commit package.json and package-lock.json only after validation.

M0 remaining: verify and wire lint/browser tests into CI; check CI result; no claim that these new tests have passed. Existing 50 MiB/64 MP acceptance limits are unchanged.

Next: M1.1 layered 2D editor, see docs/M1.md. No API/AI/desktop integration.
