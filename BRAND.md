# UniStyle Brand

Hard-coded source of truth for UniStyle's visual identity. Locked 2026-05-25.

## Relationship to Build with Baker (BwB)

UniStyle is a Build with Baker product. BwB's umbrella signature is **indigo-only** (`#2B4A8B`) per the v1.3 decision locked 2026-05-23 (see `The Architect/project-blueprints/build-with-baker/brand-state.md`).

UniStyle keeps its own **per-product accent** below the umbrella. This is explicitly allowed by `knowledge-base/adam/build-with-baker-brand-color-palette/_known-issues.md` Issue 2 - the indigo-only rule governs the BwB umbrella surface (portfolio landing page, "Made by BwB" badge), not per-product UIs that have differentiated.

The UniStyle per-product accent is **amber**, not robin red. The earlier robin-red commitment (`#C04A3A`, in code as `--us-accent` through v1.7.0) is retired as of 2026-05-25.

## Primary brand color

Indigo - inherited from BwB.

| Token | Value | Usage |
|---|---|---|
| `--bwb-brand-primary` (web) / `--primary` (extension) | `#2B4A8B` | Brand color. Primary buttons, header gradient, icon background, OG card background, theme-color meta. |
| `--bwb-brand-primary-hover` | `#243F76` | Hover state on indigo surfaces. |
| `--bwb-brand-primary-soft` | `#E8EDF7` | Soft indigo background tint on white surfaces. |

The extension popup additionally uses lifted indigo `--primary-2: #3a64a3` for gradient highlights on dark navy chrome.

## Per-product accent — amber

| Token | Value | Contrast | Usage |
|---|---|---|---|
| `--us-accent` | `#E0A82E` | 5.55:1 on `#1c3560`; 2.14:1 on white | Primary accent surface. Extension popup header badge, cleanup section button fill, focus rings, soft borders, star "favorite" state. On white surfaces: focus rings, borders, button fills (non-text uses only). |
| `--us-accent-hover` | `#C68F1F` | — | Darker hover/active for amber-filled buttons. |
| `--us-accent-soft` | `#FEF3D1` | — | Pale amber background tints, subtle chip fills. |
| `--us-accent-deep` | `#8A5A0E` | 5.74:1 on white | Amber-family color rated for **body text on white**. Use for FAQ links, any text that needs to read as accent-colored on light surfaces. Never substitute `--us-accent` here - 2.14:1 fails WCAG for text. |

The amber complements indigo on the color wheel (indigo ~218°, amber ~41° - direct complementary pair). It is meaningfully different from Ko-fi red `#FF5E5B`, so the two never read as duplicates when both appear in the footer.

## Ko-fi button — separate vendor color

Ko-fi tip buttons (`.kofi-button` on the website, `.kofi-tip-link` in the extension footer) use Ko-fi's vendor red:

| Token | Value | Usage |
|---|---|---|
| (literal) | `#FF5E5B` | Background of the "Support on Ko-fi" button on the website. |
| (literal) | `#E54845` | Hover state. |

Ko-fi red is a vendor brand color and is **not** part of UniStyle's palette. It does not change. The extension footer tip link inherits the surrounding text color rather than using the red, by deliberate choice.

## Tokens declared but unused

The website declares the four BwB status tokens for future use:

- `--bwb-status-success: #2E7D5B`
- `--bwb-status-warning: #B5851A`
- `--bwb-status-danger: #B82F2F`
- `--bwb-status-info: #3A6FA8`

None are currently referenced in markup. Reserved for future state indicators (sync errors, save confirmations, etc).

## Where each token is applied

**Extension popup (`extension/popup.css`):**

- Header bottom rule (3px): `var(--us-accent)`
- Header U badge: indigo gradient fill (`--primary-2` → `--primary`) + 1px `var(--us-accent)` border + amber glow; renders the brand-icon SVG U (not a system-font "U")
- Star button hover/on state: `var(--us-accent)` with rgba(224,168,46,…) tints
- Primary action button: `var(--primary)` indigo
- Focus rings on textarea/search: `var(--accent)` light blue `#93c5fd` (existing UI affordance, separate from brand accent)

**Extension floating panel (`extension/panel.css`):**

- Section header ("Cleanup" / "Unicode Styles" labels): neutral muted text, no accent — amber removed 2026-05-25 so the Cleanup row + Replace button reads as the sole amber focal point
- Cleanup section row left border + soft bg: `var(--us-accent)` with rgba(224,168,46,…) tints
- Cleanup "Replace" button fill: `var(--us-accent)`, hover `var(--us-accent-hover)`
- Style replace button: `#2E5082` indigo
- "Editable" mode badge: `#1f6f3c` green (functional, not brand)

**Extension toast (`extension/content.js`):**

- Toast left border: `#E0A82E` (hardcoded — content.js does not import the CSS variables)

**Website (`index.html`):**

- Header U badge: indigo SVG tile + 1px `var(--us-accent)` border + amber glow; renders the brand-icon SVG U (not a system-font "U")
- App header bottom rule (3px): `var(--us-accent)` (was `var(--accent)`/indigo, which was invisible on the indigo header bar)
- Heart / favorite buttons: `var(--us-accent)` on hover and active (was red `#d47a7a`/`#d05050`)
- Style-search focus border: `var(--us-accent)` with rgba(224,168,46,0.20) glow
- FAQ link text: `var(--us-accent-deep)` (must be -deep, not -accent, for AA on white)
- FAQ link hover: `var(--us-accent-hover)`
- FAQ link focus-visible outline: `var(--us-accent)`

**Post-copy nudge (popup, panel, website):**

A one-per-session Ko-fi tip that appears beneath the just-copied row right after a successful copy (the "moment of value" placement). Same token treatment everywhere except the surface-tuned background and message text:

- Border: `var(--us-accent)` (all three surfaces)
- Background: `--us-accent-soft` `#FEF3D1` solid on the website (light surface); `rgba(224,168,46,0.10)` on the popup and panel (dark navy surfaces)
- Message text: `var(--us-accent-deep)` on the website (AA on the soft amber fill); `var(--us-accent-soft)` on the popup and panel (light text on dark)
- Tip pill: Ko-fi vendor red `#FF5E5B`, hover `#E54845` — the same vendor red as the footer tip button, never a UniStyle token
- Frequency: once per session. Website uses `sessionStorage`; popup and panel share `chrome.storage.session` (`ahaShown`), enabled for the content-script panel by `setAccessLevel` in `background.js`. Wired to Copy only (Replace auto-dismisses the panel).

## Change history

- **2026-05-25** — Panel section-header amber accent removed (`.tf-section-header` left border + soft gradient dropped). Indigo was not a viable replacement on the dark-navy panel (invisible, same reason the site header rule moved off indigo), so the labels are now neutral muted text. Amber is now concentrated on the actionable Cleanup row + Replace button. Web app: app-footer top rule and Format Sentences button border switched to `var(--us-accent)` for header/footer symmetry.
- **2026-05-25** — Visual polish pass: brand-icon SVG U replaces the system-font "U" in the popup and site headers (indigo tile + amber border); the site app-header bottom rule switched from indigo (`--accent`, invisible on the indigo bar) to amber (`--us-accent`); heart/favorite buttons on the site switched from red to amber; new post-copy aha-nudge component (Ko-fi tip at the moment of value) added to the popup, the right-click panel, and the website.
- **2026-05-25** — Per-product accent retuned from robin red `#C04A3A` to amber `#E0A82E`. Robin red retired. `--us-accent-deep` added for text-on-white use. All `#A07020` chrome amber references in extension popup/panel/content.js migrated to the new amber tokens. BRAND.md created as the hard-coded source of truth.
- **2026-05-23** — BwB umbrella locked to indigo-only signature. UniStyle's per-product accent (then robin red) preserved as a product-level exception.
- **earlier** — Robin red `#C04A3A` established as `--us-accent` in extension and website; not applied in extension chrome due to dark-navy contrast issues.
