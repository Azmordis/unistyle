# UniStyle — Architecture Reference

Deep reference for how UniStyle is built, how it runs, and how to extend it. Pairs with [`BRAND.md`](BRAND.md) (the hard-coded visual-identity source of truth) and the root [`CLAUDE.md`](../../CLAUDE.md) (run/deploy/release/do-not-touch quick rules). Last updated 2026-05-29.

---

## 1. What UniStyle is

A text formatter that converts plain text into **22 real Unicode styles** (bold, italic, script, monospace, fullwidth/vaporwave, fraktur, double-struck, small caps, bubble, upside-down, zalgo, subscript/superscript, regional-indicator flags, etc.). Because the output is **real Unicode characters** (not Markdown), the formatting travels with the text — paste it into Discord usernames, X bios, Slack, Notion, LinkedIn, anywhere a font renders those code points.

Runs entirely in the browser. No signup, no tracking, no server. Free.

Ships in **two forms that share one engine**:

- **Web app / PWA** — `index.html` + the engine, served from GitHub Pages at the custom domain **unistyle.io**. Installable as a PWA, works offline.
- **Chrome extension (MV3)** — popup + right-click context menu + inline content-script panel + keyboard shortcuts.

The single most important architectural fact: **`engine.js` is the single source of truth for every transform, and the web copy and extension copy are kept byte-identical.** Edit `assets/js/engine.js` only, then sync the copy to `extension/engine.js`. (Verified: the two files are currently identical.)

---

## 2. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Build | **None** | Hand-authored static site. No package.json, no bundler, no dependencies |
| Engine | Vanilla ES, `engine.js` | Exposed on `window`/`globalThis`: `STYLES`, `STYLES_MAP`, `formatSentences`, `stripUnicode`, `removeFormatting`, `zalgoText`, `cp`, `mapRange` |
| Web app | Single `index.html` (~100KB, inline CSS/JS) + `assets/js/engine.js` | |
| PWA | `manifest.json` + `sw.js` | Network-first for HTML, cache-first for assets |
| Extension | MV3 — `manifest.json`, `background.js`, `content.js`, popup, `panel.css` | |
| Hosting | GitHub Pages → custom domain via `CNAME` (unistyle.io) | No build workflow; push to main publishes |

CI runs a **root-hygiene + link check only** — no build, no test runner.

---

## 3. Directory & file map

```
unistyle/
  index.html                  ★ Web app — shell + inline CSS + inline app JS (~100KB)
  manifest.json               PWA manifest (theme #2B4A8B)
  sw.js                       service worker — CACHE_NAME 'unistyle-v8', ASSETS precache list
  privacy.html                privacy policy (linked from app + extension)
  CNAME                       custom domain: unistyle.io  (DO NOT modify/remove)
  robots.txt, sitemap.xml     SEO
  favicon.ico
  CHANGELOG.md                dated release log (tied to CWS submissions)

  assets/
    js/engine.js              ★ SINGLE SOURCE OF TRUTH for all transforms
    img/og-image.jpg          absolute-URL OG image (social caches linger — don't rename casually)
    icons/                    favicon-*, icon.svg, icon-pwa-*, apple-touch-icon-180, monochrome variants

  extension/                  MV3 target
    manifest.json             version (load-bearing — must == git tag == CWS submission)
    engine.js                 byte-identical copy of assets/js/engine.js
    background.js             service worker — context menu, command handling, chrome.storage.session access level
    content.js                injected content script — inline panel, in-place transform, toast (~40KB)
    popup.html / popup.js     extension popup UI (~17KB JS)
    popup.css                 popup chrome (dark navy)
    panel.css                 floating inline panel styling (web_accessible_resource)
    icons/                    icon-16/32/48/128

  cws-submissions/            zipped extension builds for the Chrome Web Store (v1.7.1, 1.7.2, 1.8.0)

  docs/internal/
    architecture.md           this file
    BRAND.md                  ★ hard-coded color/identity source of truth (indigo umbrella + amber accent)
```

---

## 4. How it works — the engine

Plain text uses standard Unicode (`U+0041` = "A"). UniStyle maps each character to its equivalent glyph in **another Unicode block**:

- Bold / italic / script / fraktur / double-struck / monospace → **Mathematical Alphanumeric Symbols** (`U+1D400+`)
- Fullwidth (vaporwave) → **Halfwidth and Fullwidth Forms** (`U+FF21+`)
- Zalgo → **Combining Diacritical Marks** stacked on each base glyph
- Small caps / bubble / upside-down / subscript / superscript → dedicated exception maps

This is fundamentally different from Markdown: the output is real Unicode that displays styled glyphs anywhere a font renders those code points — usernames, bios, status fields, third-party clients.

**Engine internals worth knowing:**

- `cp(n)` → `String.fromCodePoint(n)`. `mapRange(text, ucBase, lcBase, dgBase)` → the workhorse that shifts A–Z / a–z / 0–9 to a target block base.
- **Grapheme-aware iteration** via `Intl.Segmenter` (with a code-point fallback). Combining-mark styles (underline, strikethrough, zalgo) iterate **graphemes** so ZWJ emoji sequences (👨‍👩‍👧), skin-tone modifiers, and variation selectors are treated as one unit. `isEmojiGrapheme(g)` skips emoji/pictographs/regional-indicators so combining marks don't break the visible glyph.
- Letters with no Mathematical-Alphanumeric code point use hardcoded **exception arrays** (`SCRIPT_UPPER`, `SCRIPT_LOWER`, `FRAKTUR_UPPER`, `DS_UPPER`, etc.) that point at the scattered letter-like symbols (e.g. `ℬ`, `ℰ`, `ℋ`) Unicode placed outside the main block.
- **Cleanup transforms** (not Unicode styling): `formatSentences`, `stripUnicode` (fancy → ASCII), `removeFormatting` (stripUnicode + Markdown + punctuation), plus CAPS/lowercase/Title Case in the UI.

---

## 5. The STYLES model

Every style is an object in the `STYLES` array (`engine.js`, starting ~line 200), keyed in `STYLES_MAP` for lookup:

```js
{
  key: 'bold',                    // stable id
  label: 'Bold',                  // display name
  compat: { d:2, t:2, n:2, s:0 }, // platform support: Discord/Twitter/Notion/Slack (0=none,1=partial,2=full)
  fn: t => mapRange(t, 0x1D400, 0x1D41A, 0x1D7CE)  // the transform: plain text → styled text
}
```

Some `fn`s take a second argument (e.g. `zalgo`'s `level`). The UI reads `compat` to render the per-platform support badges and `label` for the style name.

---

## 6. Extension architecture (MV3)

- **`background.js`** (service worker): registers the right-click context menu ("Format with UniStyle"), handles the three keyboard commands, and calls `setAccessLevel` so the content-script panel can share `chrome.storage.session` (used for the once-per-session post-copy Ko-fi nudge, key `ahaShown`).
- **`content.js`** (injected): renders the floating inline panel, performs **in-place transforms** on the selected text, and shows the copy/replace toast. Note: `content.js` does **not** import the CSS variables — its toast left-border amber `#E0A82E` is hardcoded.
- **`panel.css`** is a `web_accessible_resource` (matches `<all_urls>`) so the injected panel can be styled on any page.
- **Permissions:** `contextMenus, activeTab, scripting, storage, clipboardWrite`.
- **Keyboard commands:** `Ctrl+Shift+Y` open popup · `Ctrl+Shift+U` transform selection in place with last-used style · `Ctrl+Shift+F` open inline panel for the selection.

---

## 7. How to add a new Unicode style (the main extension point)

1. Add a style object to the `STYLES` array in **`assets/js/engine.js`** with `key`, `label`, `compat` (`{d,t,n,s}` support flags), and a `fn` transform mapping input chars to the new Unicode range.
2. For partial-alphabet coverage, document the gap in a `tip`/tooltip so users know which letters don't convert.
3. **Sync the engine to the extension:** copy `assets/js/engine.js` → `extension/engine.js` so the two stay byte-identical.
4. If shipping the extension, follow the release contract (section 8).

The web app and extension both read from `STYLES`, so a correctly added style appears in both with no further wiring.

**File-placement rule (root is locked):** new web asset (img/css/js) → `assets/`; extension code → `extension/`; planning/spec/brand doc → `docs/internal/`. Per the Build with Baker Repo Standard v2.0.

---

## 8. Run, deploy, release

```bash
# Web app
open index.html            # or: npx serve .   (service worker needs HTTP, not file://)

# Extension
# load extension/ unpacked via chrome://extensions (Developer mode)
```

**Web deploy:** GitHub Pages serves the repo root to the `CNAME` domain (unistyle.io). No workflow builds the site — **pushing to main publishes it.** When `index.html` or any precached asset changes, bump `CACHE_NAME` in `sw.js` (currently `unistyle-v8`) so installed PWAs flush the old cache.

**Extension release contract (Chrome Web Store).** For every CWS submission, all three must move together:

1. Bump `extension/manifest.json` `"version"`.
2. Add a dated entry to `CHANGELOG.md`.
3. Cut an annotated git tag `vX.Y.Z` that **equals** the manifest version.

Keep `tag == extension/manifest.json version`, always. Zipped submissions land in `cws-submissions/`.

---

## 9. Brand / formatting conventions

Full detail in [`BRAND.md`](BRAND.md) — read it before touching any color. Summary:

- **Indigo `#2B4A8B`** is the primary brand color, inherited from the Build with Baker umbrella (indigo-only signature). Primary buttons, header gradient, icon background, theme-color meta.
- **Amber `#E0A82E`** (`--us-accent`) is the UniStyle **per-product accent** — allowed below the BwB umbrella. Used for the header badge border/glow, the Cleanup section + Replace button, focus rings, favorite-star state. The earlier robin-red `#C04A3A` accent is **retired** (2026-05-25).
- `--us-accent-deep #8A5A0E` is the amber-family color rated for **body text on white** (5.74:1). Never use `--us-accent` for text on white — it fails WCAG (2.14:1).
- **Ko-fi red `#FF5E5B`** is a vendor color (tip buttons), not part of the palette.
- The header "U" badge renders a brand-icon **SVG U**, not a system-font "U", on both the popup and the website.

---

## 10. Privacy & gotchas / do-not-touch

- **Privacy:** all conversion happens locally in JS — nothing is sent to a server, saved server-side, or logged. The PWA stores recent inputs in `localStorage` (History feature) on-device only.
- **`CNAME` is the custom domain (unistyle.io)** — do not modify or remove.
- **`sw.js` MUST stay at the repo root** — moving it shrinks the service-worker scope and GitHub Pages can't send `Service-Worker-Allowed` to widen it.
- **`assets/img/og-image.jpg` is referenced by an absolute `https://unistyle.io/...` URL** in `index.html`; social caches linger, so don't rename or move it casually.
- **`extension/manifest.json` "version" is load-bearing** — it must match the CWS submission and the git tag.
- **`docs/internal/BRAND.md` is the hex source of truth** for the amber accent (`--us-accent #E0A82E`). Keep code comments pointing there; don't fork color values into code.
- **Edit `assets/js/engine.js` only**, then sync to `extension/engine.js`. Never edit the extension copy independently — they must stay byte-identical.
```
