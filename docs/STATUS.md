# Status

## Verified baseline
At 73fc65c, user reported lint PASS, typecheck PASS, 20/20 unit tests PASS, build PASS, 4/4 browser tests PASS; manually confirmed patch and mask work. Existing E2E did not cover repair specifically. Remote CI status not confirmed.

## Current increment — history and transform handles (pending validation)
Bounded undo/redo (30 snapshots, 256 MP retained asset budget), source reset, asset URL retention and release, focused Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z. Mouse wheel cursor-centered zoom, visible transform frame, proportional corner scaling, independent edge stretch, rotation handle with Shift 15° snap. Preview during drag, single committed edit at release, cancel on Escape/pointercancel. Numeric scale and stretch remain accessible. No new dependencies.

11 new unit cases written; browser scenarios to verify direct transforms, history and reconstruction. No new tests executed by remote authoring environment. Run lint, typecheck, test, build, test:e2e locally then visually validate. Limits: in-memory only, no perspective warp, source-only patch sampling, no automatic background repair. Next: editable geometry (polyline, polygon, vertices), then saved projects and composite PNG export, complete AI handoff.

## M1.4.2 — perspective (pending validation)
Introduced independent convex quad deformation for unlocked visible raster/patch layers, composed with standard transforms; reset and history support. Seven new unit scenarios written. No new dependency. M1.3.3 through M1.4.2 not yet validated locally; no claim of test execution. Next steps: E2E perspective/history/repair checks, editable vector geometry (M1.5), then persistence and composite PNG export. Current ordinary transform handles show the pre-warp affine reference frame; perspective mode shows the actual warped corners.

## M1.5 — vector geometry (pending validation)
Open lines and closed polygons in source pixels, editable vertex handles, whole-shape dragging, insertion/removal, Shift grid snap, style, visibility and lock. Separate vector stack above all raster layers; integrated document history. Original unchanged. Seven unit tests and browser geometry scenario added; new tests not executed remotely. User has not supplied validation output for M1.3.3–M1.5 yet. Next M1.6: versioned project persistence and composite export (including projective raster transforms and vectors); then complete manual AI handoff.
