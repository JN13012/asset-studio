# Product specification

## Goal
Create a focused asset editor for games: precise local image edits, structured visual feedback to an external AI, followed by manual import of the resulting image. ZERO//DAY is the first use case, not a hard dependency.

## Workflow
1. Import a PNG, JPEG or WebP reference.
2. Inspect it at its native aspect ratio using zoom and pan.
3. Create editable layers and make deterministic transformations.
4. Mark areas to remove, add, replace or preserve; draw target geometry; attach textual instructions.
5. Export source, annotated preview, mask, geometry and instructions as a manual AI handoff.
6. Share selected files in ChatGPT, receive a generated result, import it as a new revision and compare.

## V0 acceptance
A user can prepare a port or airport correction without changing the source, produce an export with source-aligned coordinates and clearly defined edit/protect masks, and repeat the cycle with a regenerated asset. No automatic AI integration in V0.

## Design
Dark compact workspace: menu, tools, central canvas, layers/properties and status. Work area takes priority. Disabled tools must be clearly identified, not simulate functionality. UI starts in French; labels may be localized later.

## Non-goals
Photoshop parity, photorealistic 3D rendering, AI generation, collaboration accounts, cloud storage, desktop application, and map integration in the first MVP.
