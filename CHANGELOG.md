# Changelog

## 1.8.0 - 2026-05-29
- Right-click panel is now **draggable** — grab the header to reposition it anywhere on the page (stays clamped on-screen). The close button and body controls keep working normally.
- Right-click panel cleanup actions (Format Sentences, Strip Unicode, Remove Formatting) now show **one at a time** with ‹ › arrows to cycle and the last-used option shown first, matching the popup's cleanup carousel.

## 1.7.2 - 2026-05-28
- Added **Remove Formatting**: strips bold/italic/Markdown and pasted rich-text formatting back to plain text (like "Paste as plain text"). Available in the web app, the right-click panel, and the popup.
- Popup redesigned: Format Sentences, Strip Unicode, and Remove Formatting now share a single **cleanup carousel** (one tool at a time, prev/next, last-used shown first), replacing the standalone Format Sentences and Strip buttons.
- Fixed: **Strip Unicode was scrambling ordinary text** (letters b/d/n/u/q/p swapped via the upside-down and small-caps reverse maps, e.g. "quick brown" became "bnick qrowu"). Now only non-ASCII glyphs are reverse-mapped, so plain text passes through untouched.

## 1.7.1 - 2026-05-25
- Right-click panel now shows all 22 styles by default instead of 7. Users can still favorite/unfavorite to customize.
