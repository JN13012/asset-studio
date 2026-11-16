# Status

## Verified baseline
User reported at 739bd5b: lint PASS, typecheck PASS, 11/11 Vitest, build PASS, 3/3 Playwright; visual overlay size and opacity confirmed. M0 and initial M1.1 validated locally. Production audit previously clean; moderate development-only minimatch advisory temporarily accepted. Remote CI status not confirmed.

## Current increment — polygon extraction and direct movement
Added source-space polygon selection, remove last vertex/cancel, copy to a transparent cropped local PNG layer, select and drag unlocked layers. Original bytes and pixels unchanged; copy leaves original object visible. Numeric scale and rotation remain available. Four unit tests and one browser scenario added; not executed in authoring environment. No dependency changes. Re-run lint, typecheck, unit tests, build and browser scenarios locally.

Current limitations: lasso samples original source only, not composite; transparent pixels in layer bounding boxes are selectable; no erase/reconstruction, save, undo, handles or geometry warping. Next prioritize old-location cleanup and manual AI annotations, then transform handles and editable geometry.
