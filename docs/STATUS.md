# Status

## M0 — final correction pending verification
User workstation at 84bfa18: production audit 0 vulnerabilities; development audit 7 moderate alerts from minimatch via typescript-eslint (DoS), temporarily accepted as non-blocking. Typecheck PASS, 5/5 unit tests PASS, build PASS, 2/2 Chromium smoke tests PASS. Lint failed on preserve-caught-error in sourceImage.ts. Commit 48b9fb7 corrects the error cause and enables lint/Chromium in CI with production-only blocking audit.

## M1.1 — initial raster layers implemented, pending validation
Native DOM rendering retained to avoid new dependencies. Source preserved and locked; overlays added from local files, selected, renamed, hidden, reordered, locked, deleted, with opacity and numerical X/Y, scale and rotation. All transforms in source coordinates, clipped to document bounds. No automatic extraction, persistence, undo, on-canvas transform handles or export yet. Layer metadata separate from source asset URLs; URL cleanup on removal/replacement/unmount. 32 layer limit and 128 MP cumulative acceptance check. Six new unit cases and one browser scenario written, not executed in remote authoring environment.

Run npm ci, npm run lint, npm run typecheck, npm run test, npm run build, npm run test:e2e on workstation, inspect GitHub Actions, then verify visually. Browser fixture is synthetic. No changes to package.json or lockfile.

Next: finish M1.2 interactive transformations and history, then M1.3 manual polygon cutout (retain source, no automatic reconstruction).
