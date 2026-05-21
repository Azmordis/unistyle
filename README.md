# UniStyle

[![Ko-fi](https://img.shields.io/badge/Ko--fi-Support-FF5E5B?logo=ko-fi&logoColor=white)](https://ko-fi.com/abaker421)
[![Live](https://img.shields.io/badge/Live-unistyle.io-2E5082)](https://unistyle.io)
[![License](https://img.shields.io/badge/License-MIT-blue)](LICENSE)

> Convert plain text into 22 Unicode styles for Discord, Notion, X, Slack, and anywhere Unicode renders. Free. No signup, no tracking, no server.

## Try it now

- **Web app:** [unistyle.io](https://unistyle.io) - works in any modern browser, installable as a PWA on desktop and Android
- **Chrome Extension:** Coming soon to the Chrome Web Store

## What it does

UniStyle generates real Unicode characters that look bold, italic, scripted, monospace, and more. Because the output is real Unicode (not Markdown), the formatting travels with the text - paste it into Discord usernames, X bios, Slack messages, LinkedIn headlines, anywhere a text field renders Unicode.

Type:

```
Hello World
```

Get back:

```
𝐇𝐞𝐥𝐥𝐨 𝐖𝐨𝐫𝐥𝐝     ← bold
𝐻𝑒𝑙𝑙𝑜 𝑊𝑜𝑟𝑙𝑑     ← italic
𝓗𝓮𝓵𝓵𝓸 𝓦𝓸𝓻𝓵𝓭     ← script
Ｈｅｌｌｏ Ｗｏｒｌｄ     ← fullwidth (vaporwave)
```

...and 18 more.

## Features

- **22 Unicode styles:** bold, italic, bold italic, sans-serif bold, sans-serif italic, sans-serif bold italic, underline, strikethrough, monospace, script, fraktur, double-struck, fullwidth, small caps, bubble, upside down, reverse, alternating case, zalgo, subscript, superscript, regional indicator (country flag codes)
- **Style combiner:** stack a modifier (strikethrough, underline, overline, reverse) on any base style
- **Favorites:** pin your most-used styles
- **History:** recent transformations are saved locally
- **Special characters row:** quick-insert for em dashes, ellipsis, smart quotes, etc.
- **Cleanup transforms:** Format Sentences, CAPS, lowercase, Title Case, Strip Unicode
- **Keyboard shortcuts** (extension): `Ctrl+Shift+Y` opens popup, `Ctrl+Shift+U` transforms selected text with last-used style, `Ctrl+Shift+F` opens inline panel
- **Right-click context menu** (extension): "Format with UniStyle" on any selected text
- **PWA installable** (web): works offline once installed

## How it works

Plain text uses standard Unicode (U+0041 = "A"). UniStyle maps each character to its equivalent in another Unicode block - "Mathematical Alphanumeric Symbols" (U+1D400+) for bold/italic/script/fraktur, "Halfwidth and Fullwidth Forms" (U+FF21+) for fullwidth, "Combining Diacritical Marks" for zalgo, etc. The output is real Unicode that displays styled glyphs anywhere a font renders those code points.

This is different from Markdown formatting (which only works inside platforms that parse it). UniStyle output works in usernames, bios, status fields, third-party clients, and anywhere plain text is accepted.

## Privacy

UniStyle runs entirely in your browser. Text typed into the tool is converted locally on your device using JavaScript - **nothing is sent to a server, saved to a database, or logged**. No analytics capture user input. The optional PWA stores recent inputs in `localStorage` (on your device only) so the History feature can show recent text; clear at any time via the Clear button.

Full privacy policy: [unistyle.io/privacy](https://unistyle.io/privacy)

## Local development

```bash
git clone https://github.com/Azmordis/unistyle.git
cd unistyle
# Serve over HTTP for the service worker to register correctly:
python3 -m http.server 8000
# Then open http://localhost:8000 in a browser
```

No build step. No dependencies. Edit `index.html`, `engine.js`, `sw.js` directly.

The Chrome extension lives in a separate folder structure (not in this repo - the extension is packaged from a parallel working tree). The shared `engine.js` is kept byte-identical between the web and extension copies.

## Contributing

Issues and pull requests welcome. For larger changes please open an issue first to discuss.

When adding a new Unicode style:

1. Add the style definition to `engine.js` in the `STYLES` array
2. Include `key`, `label`, `compat` (Discord/Twitter/Notion/Slack support), `tip` (tooltip explaining the style)
3. Implement the transform function `fn` that maps input chars to the new Unicode range
4. For styles with partial alphabet coverage, document the gap in the `tip`

## Support

If UniStyle saved you time, a coffee on [Ko-fi](https://ko-fi.com/abaker421) keeps the builds coming. The tool is free and stays free either way.

## License

MIT - see [LICENSE](LICENSE) for details.

## Author

Built by Adam Baker - part of [Build with Baker](https://ko-fi.com/abaker421), a small-tool maker brand for things that make the web a little less annoying.

Other tools coming. Feel free to follow along.
