# Asset Studio project format — v1

A .assetstudio file is a self-contained local binary container. No backend, remote upload, external assets, or new packages.

- 8 ASCII bytes: ASTUDIO1.
- 4 bytes: little-endian unsigned JSON manifest byte length.
- UTF-8 JSON manifest (version 1, raster layers, asset descriptors, vector shapes, repair regions, selected IDs).
- Concatenated original PNG/JPEG/WebP asset bytes in manifest asset order.

Source bytes are stored unchanged. Object URLs and decoded images are runtime-only. Source layer is locked and fixed at bottom. Opening validates metadata, asset count, coordinates, transforms, unique IDs, lengths, decoded dimensions and total pixel budget; partial failures revoke temporary URLs and retain current document. Limits: 256 MiB container, 8 MiB manifest, existing 32 raster layer/128 MP document limits. No compression beyond original encoded images. History, unfinished gestures, viewport and current tool are not persisted; opening starts a fresh history. Save explicitly; no autosave yet.
