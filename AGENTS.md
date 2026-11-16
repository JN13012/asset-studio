# Asset Studio contributor instructions

- Read docs/PRODUCT.md, docs/ARCHITECTURE.md, docs/ROADMAP.md and docs/STATUS.md before modifying code.
- Work one milestone or coherent feature at a time; plan first, implement, verify and report. Do not advance scope without agreement.
- V0: browser-only, local-first, manual AI handoff. No network image upload, backend, credentials, third-party telemetry or desktop packaging.
- Preserve original image bytes; keep annotations, masks, transforms and the camera separate. Use source-image pixel coordinates for saved edits.
- Use strict TypeScript, accessible controls and explicit error states. Prefer native browser APIs and small focused modules; introduce dependencies when a feature requires them.
- Never claim a test passed unless executed. Run typecheck, tests and build, then verify the affected browser workflow. Keep docs/STATUS.md current.
- Commit by coherent feature. Do not force-push or rewrite history. For local implementers, push only with explicit approval.
- No secrets, user images or generated handoff archives in this public repository. Use synthetic fixtures.
