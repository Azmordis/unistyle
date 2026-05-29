# CLAUDE.md - UniStyle

See @README.md for what this project is and why.

UniStyle is a hand-authored static site (no build step, no package.json) plus a
Manifest V3 Chrome extension in `extension/`. The web app and the extension
share the same Unicode formatting engine.

## Run / test
- Web app: open `index.html` directly, or `npx serve .` for a local server.
- Extension: load `extension/` unpacked via chrome://extensions (Developer mode).
- There is no build and no test runner; CI runs a root-hygiene + link check only.

## Deploy
- GitHub Pages serves the repo root to the custom domain in `CNAME`
  (unistyle.io). No workflow builds the site - pushing to main publishes it.

## Releases (Chrome Web Store contract)
- The extension has a real release contract. For every CWS submission:
  1) bump `extension/manifest.json` "version",
  2) add a dated entry to `CHANGELOG.md`,
  3) cut an annotated git tag `vX.Y.Z` that EQUALS the manifest version.
  Keep tag == `extension/manifest.json` version, always.

## File organization (root is locked)
Do not add files to the repo root unless they are in the permitted-root-files
table of the Build with Baker Repo Standard v2.0. Before creating any new file:
1) identify which folder it belongs in, 2) create it if missing, 3) add it there.
- New web asset (img/css/js) -> assets/; extension code -> extension/;
  planning/spec/brand doc -> docs/internal/.

## Code style
- 2-space indent
- ES modules where applicable (the extension is MV3 - no CDN/inline scripts)

## Do not touch
- CNAME is the custom domain (unistyle.io) - do not modify or remove.
- sw.js MUST stay at the repo root - moving it shrinks the service-worker scope
  and GitHub Pages cannot send Service-Worker-Allowed to widen it.
- The og:image meta in index.html is an absolute https://unistyle.io/...jpg URL;
  social caches linger, so don't rename or change its path casually.
- docs/internal/BRAND.md is the hard-coded hex source of truth for the amber
  per-product accent (--us-accent #E0A82E). Keep code comments pointing there.
- extension/manifest.json "version" is load-bearing - it must match the CWS
  submission and the git tag (see Releases above).
