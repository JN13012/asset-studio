# Architecture

## Decisions
- React + strict TypeScript + Vite. Use browser APIs initially; add Konva for object-based 2D editing at M1 when needed. Later Three.js for 3D.
- Single frontend, no mandatory backend. Images and generated exports stay in the browser until the user explicitly downloads or shares them.
- State is plain serializable document data, separated from transient viewport state and render objects. React state initially; consider Zustand when cross-tool state grows.
- Blob/File source assets are kept separately from document metadata. Revoke object URLs after use. IndexedDB and project serialization planned for M1; no localStorage for binary assets.
- Geometry and masks use original decoded image pixels (top-left origin, x right, y down); viewport CSS pixels and devicePixelRatio never change the document coordinates.
- Non-destructive edits; future undo/redo command history. Preserve source bytes and document version. Treat imported file names and metadata as untrusted.
- PNG exports retain alpha. Rasterize at source or explicit export dimensions, not screenshot resolution. No remote fonts, telemetry or runtime assets.
- Test pure geometry independently; browser tests exercise rendering and import. Use synthetic fixtures. Avoid claiming pixel-accurate AI edits: only deterministic local operations provide exact results.

## Module plan
```text
src/
  app/          shell and orchestration
  core/         pure document and coordinate model
  editor2d/     viewport, layers, selection, tools (incremental)
  storage/      IndexedDB and project files (M1+)
  exports/      image and handoff packages (M2)
  geometry/     vector constraints (M4)
  editor3d/     3D scene (M5)
  assets/       component library (M7)
  preview/      map preview (M8)
tests/          browser scenarios (M0+)
docs/           decisions and acceptance
```
Only create directories and dependencies that are actually used. M0 shell uses React state and native rendering; do not implement future modules prematurely.
