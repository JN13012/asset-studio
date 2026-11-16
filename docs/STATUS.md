# Status

## M0 — final correction pending verification

User workstation at 84bfa18: production audit 0 vulnerabilities; development audit 7 moderate alerts from minimatch through typescript-eslint (DoS), accepted temporarily as non-blocking. Typecheck PASS, 5/5 unit tests PASS, build PASS, 2/2 Chromium smoke tests PASS. Lint failed on preserve-caught-error in sourceImage.ts.

This commit preserves the original error cause, enables lint and Chromium in CI, and separates blocking production audit from informational full audit. Re-run lint and CI to confirm. No new dependency installed.

## Security policy
Review development advisories in context; moderate development-only findings do not block local feature work. Review critical/exploitable findings and production advisories; do not apply forced npm upgrades blindly. Local-only does not eliminate risk.

Next: M1.1 layer foundation. No automatic AI or desktop packaging.
