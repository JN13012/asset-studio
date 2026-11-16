# Manual AI handoff — v1

Implemented in M2; pending workstation validation.

Prepare dossier IA in the inspector; enter global request and use the mask tool for edit / protect polygons. Existing per-region instructions saved inside project. Prepare generates eight files, individually downloadable or ZIP32 stored archive:
- original.png/jpg/webp: original exact bytes.
- edited.png: composition at decoded source dimensions.
- annotated.png: composition with numbered edit/protect regions.
- edit-mask.png / protect-mask.png: opaque binary black/white RGBA PNG, source dimensions. Protect overrides edit on overlap; white means edit/protect respectively. If no explicit edit region exists, global edit except protected pixels (documented separately).
- geometry.svg: visible vector targets with style, source viewBox.
- instructions.md: global request, region instructions, camera/style/preserve constraints.
- manifest.json: source SHA-256, metadata, region operations, coordinate convention, raster metadata, geometry, files and edit policy.

Send the relevant files manually to ChatGPT; no API or upload from Asset Studio. Generative image output is not guaranteed to follow exact geometry. Import result IA accepts same-size raster; with edit regions, replace only allowed pixels in CURRENT composite; without edit regions, allow entire image except protected pixels. This enforces masks at import using decoded RGBA pixel compositing (not original compressed byte equality). Keep the old editable layers and vectors hidden and add new flattened revision; undo restores previous state. Save projects manually. User must not change composition between export and result import unless intended. No automatic revision alignment or resize.
