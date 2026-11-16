# Roadmap

| Milestone | Scope and exit criteria |
|---|---|
| M0 foundation | Local app opens; import PNG/JPEG/WebP, error handling, dimensions, fit/zoom/pan, accessible shell; committed lockfile, lint/typecheck/test/build, browser import test. |
| M1 2D editor | Editable layers, visibility, ordering, opacity, move/rotate/scale, undo/redo, save and reopen local projects; original protected. |
| M2 manual AI handoff | Brush/polygon annotations and edit/protect masks, per-region instructions, preview and source-sized export package; round trip with a regenerated image. |
| M3 selection | Crop, selection, removal and transparency; extraction into new layers; alpha preserved. |
| M4 geometry | Polygon/polyline/shape editing, grid, snap, dimensions and angles; source-space export. |
| M5 3D builder | Primitive volumes and extrusion, transform controls, orthographic camera; basic scene storage. |
| M6 rendering | Materials, textures, lighting, transparent PNG output and consistent camera presets. |
| M7 library | Reusable asset components and metadata, import/export, revision management. |
| M8 game preview | Place and compare assets on a map/reference background; scale/orientation presets; no mandatory game coupling. |

M0–M2 = V0 MVP. M3–M8 = V1 incremental. API integration, local AI, Windows packaging explicitly deferred with no scheduled milestone.

## Work sequence
1. Bootstrap repo and source shell.
2. Install dependencies and commit lockfile; validate actual browser import.
3. Finish M0 quality checks and CI.
4. Review M0 with user before M1.
5. Repeat: agree criteria, implement, run checks, record results, commit per feature, review.
