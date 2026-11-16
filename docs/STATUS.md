# Status

## Bootstrap — M0 in progress
Remote bootstrap includes the React/Vite shell, local file import (PNG/JPEG/WebP), intrinsic dimensions, checkerboard image background, fit/zoom/pan, and five viewport unit test cases. Only the image source layer exists. Source file remains in memory, not in a persisted project.

Not yet validated in the browser or compiled; the implementation environment cannot resolve the public npm registry. No lockfile is committed.

Next checks:
- Install dependencies using npm install; review npm audit and lockfile; commit package-lock.json.
- Execute npm run typecheck, npm run test and npm run build.
- Add lint, CI and Playwright browser smoke test. Validate drag/drop, alpha, image replacement, large images and error handling. Improve viewport ergonomics if necessary.
- Record actual results and obtain user visual review before M1.

Initial choices: UI French; native DOM image rendering in M0; no Konva until M1; 50 Mio encoded file and 64 MP decoded-size acceptance limits (post-decode check, not a hard memory bound).
