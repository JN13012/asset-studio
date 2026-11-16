# Manual AI handoff — proposed v1 contract

Target of M2; this is a specification, not an implemented feature.

A handoff export contains:
- original.<ext>: exact original input bytes.
- annotated.png: source-size visual preview with corrections rendered and a separate legend (legend outside image or in instructions, not within mask coordinates).
- edit-mask.png: 8-bit grayscale PNG, white = editable, black = not selected, same decoded width/height as source.
- protect-mask.png: 8-bit grayscale PNG, white = must preserve; protective regions override edit masks on overlap.
- geometry.svg: source-sized viewBox, vector target geometry only; no remote references or scripts.
- instructions.md: user intent, ordered operations, preserve list, style and camera constraints.
- manifest.json: schemaVersion, source file name and MIME, source dimensions, coordinate convention, list of operations, file paths and source SHA-256.

All masks use decoded source-image coordinates, independent of pan, zoom, or display DPI. No ambiguous color-only semantics: annotate operations with IDs and explicit add/remove/replace/preserve intent. Keep annotations editable in the project, not burned into the source.

Provide individual files for manual upload to ChatGPT; a ZIP may be offered for archiving but is not required for chat compatibility. Do not promise exact generative geometry or automatic conversation synchronization. Source-region compositing may be used locally when exact preservation is required.

M2 acceptance: synthetic reference with known pixels, masks have identical dimensions, protected overlap verified, manifest schema validated, instructions and previews agree; import a manually supplied result as a new revision.
