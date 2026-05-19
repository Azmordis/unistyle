# Text Formatter — Future Style Enhancements

Each block below is a ready-to-drop-in entry for the `STYLES` array in `index.html`.
Add as many as you want — each one gets its own output card automatically.

---

## How to add a style

In `index.html`, find the `STYLES` array and append an object:

```js
{
  key: 'uniqueKey',    // used for DOM IDs — no spaces
  label: 'Display Label',
  fn(text) {
    return [...text].map(ch => { /* transform ch */ return ch; }).join('');
  }
}
```

---

## Ready-to-use style blocks

### Bold Sans-Serif
Works especially well in messaging apps (the style WhatsApp renders for **bold**).

```js
{
  key: 'boldSans',
  label: 'Bold Sans',
  fn(text) {
    return [...text].map(ch => {
      const c = ch.charCodeAt(0);
      if (ch >= 'a' && ch <= 'z') return cp(0x1D5EE + c - 97);
      if (ch >= 'A' && ch <= 'Z') return cp(0x1D5D4 + c - 65);
      if (ch >= '0' && ch <= '9') return cp(0x1D7EC + c - 48);
      return ch;
    }).join('');
  }
}
```
Preview: 𝗛𝗲𝗹𝗹𝗼 𝗪𝗼𝗿𝗹𝗱

---

### Italic Sans-Serif

```js
{
  key: 'italicSans',
  label: 'Italic Sans',
  fn(text) {
    return [...text].map(ch => {
      const c = ch.charCodeAt(0);
      if (ch >= 'a' && ch <= 'z') return cp(0x1D622 + c - 97);
      if (ch >= 'A' && ch <= 'Z') return cp(0x1D608 + c - 65);
      return ch;
    }).join('');
  }
}
```
Preview: 𝘏𝘦𝘭𝘭𝘰 𝘞𝘰𝘳𝘭𝘥

---

### Bold Italic Sans-Serif

```js
{
  key: 'boldItalicSans',
  label: 'Bold Italic Sans',
  fn(text) {
    return [...text].map(ch => {
      const c = ch.charCodeAt(0);
      if (ch >= 'a' && ch <= 'z') return cp(0x1D656 + c - 97);
      if (ch >= 'A' && ch <= 'Z') return cp(0x1D63C + c - 65);
      return ch;
    }).join('');
  }
}
```
Preview: 𝙃𝙚𝙡𝙡𝙤 𝙒𝙤𝙧𝙡𝙙

---

### Monospace
Looks like code. Good for technical content or retro aesthetic.

```js
{
  key: 'monospace',
  label: 'Monospace',
  fn(text) {
    return [...text].map(ch => {
      const c = ch.charCodeAt(0);
      if (ch >= 'a' && ch <= 'z') return cp(0x1D68A + c - 97);
      if (ch >= 'A' && ch <= 'Z') return cp(0x1D670 + c - 65);
      if (ch >= '0' && ch <= '9') return cp(0x1D7F6 + c - 48);
      return ch;
    }).join('');
  }
}
```
Preview: 𝙷𝚎𝚕𝚕𝚘 𝚆𝚘𝚛𝚕𝚍

---

### Script / Cursive
Decorative. Has specific exceptions for e, g, o (lowercase) and B, E, F, H, I, L, M, R (uppercase).

```js
{
  key: 'script',
  label: 'Script',
  fn(text) {
    // Exceptions: some letters map to letterlike-symbols block instead of math script block
    const lowerMap = [
      0x1D4B6,0x1D4B7,0x1D4B8,0x1D4B9, // a b c d
      0x212F,                            // e → ℯ
      0x1D4BB,                           // f
      0x210A,                            // g → ℊ
      0x1D4BD,0x1D4BE,0x1D4BF,          // h i j
      0x1D4C0,0x1D4C1,0x1D4C2,0x1D4C3, // k l m n
      0x2134,                            // o → ℴ
      0x1D4C5,0x1D4C6,0x1D4C7,0x1D4C8, // p q r s
      0x1D4C9,0x1D4CA,0x1D4CB,0x1D4CC, // t u v w
      0x1D4CD,0x1D4CE,0x1D4CF          // x y z
    ];
    const upperMap = [
      0x1D49C,                           // A
      0x212C,                            // B → ℬ
      0x1D49E,0x1D49F,                   // C D
      0x2130,                            // E → ℰ
      0x2131,                            // F → ℱ
      0x1D4A2,                           // G
      0x210B,                            // H → ℋ
      0x2110,                            // I → ℐ
      0x1D4A5,0x1D4A6,                   // J K
      0x2112,                            // L → ℒ
      0x2133,                            // M → ℳ
      0x1D4A9,0x1D4AA,0x1D4AB,0x1D4AC, // N O P Q
      0x211B,                            // R → ℛ
      0x1D4AE,0x1D4AF,0x1D4B0,          // S T U
      0x1D4B1,0x1D4B2,0x1D4B3,0x1D4B4, // V W X Y
      0x1D4B5                            // Z
    ];
    return [...text].map(ch => {
      const c = ch.charCodeAt(0);
      if (ch >= 'a' && ch <= 'z') return cp(lowerMap[c - 97]);
      if (ch >= 'A' && ch <= 'Z') return cp(upperMap[c - 65]);
      return ch;
    }).join('');
  }
}
```
Preview: 𝒮𝒸𝓇𝒾𝓅𝓉 𝓁𝑒𝓉𝓉𝑒𝓇𝓈

---

### Fraktur / Gothic
Medieval look. Has exceptions for C, H, I, R, Z (uppercase) — no exceptions for lowercase.

```js
{
  key: 'fraktur',
  label: 'Fraktur',
  fn(text) {
    const upperMap = [
      0x1D504,0x1D505,                   // A B
      0x212D,                            // C → ℭ
      0x1D507,0x1D508,0x1D509,0x1D50A, // D E F G
      0x210C,                            // H → ℌ
      0x2111,                            // I → ℑ
      0x1D50D,0x1D50E,0x1D50F,          // J K L
      0x1D510,0x1D511,0x1D512,0x1D513, // M N O P
      0x1D514,                           // Q
      0x211C,                            // R → ℜ
      0x1D516,0x1D517,0x1D518,          // S T U
      0x1D519,0x1D51A,0x1D51B,0x1D51C, // V W X Y
      0x2128                             // Z → ℨ
    ];
    return [...text].map(ch => {
      const c = ch.charCodeAt(0);
      if (ch >= 'a' && ch <= 'z') return cp(0x1D51E + c - 97); // no exceptions
      if (ch >= 'A' && ch <= 'Z') return cp(upperMap[c - 65]);
      return ch;
    }).join('');
  }
}
```
Preview: 𝔉𝔯𝔞𝔨𝔱𝔲𝔯 𝔩𝔢𝔱𝔱𝔢𝔯𝔰

---

### Double-Struck (Blackboard Bold)
Used in math for sets like ℝ, ℤ, ℕ. Also popular decoratively.
Has exceptions for C, H, N, P, Q, R, Z (uppercase) — no exceptions for lowercase.

```js
{
  key: 'doubleStruck',
  label: 'Double Struck',
  fn(text) {
    const upperMap = [
      0x1D538,0x1D539,                   // A B
      0x2102,                            // C → ℂ
      0x1D53B,0x1D53C,0x1D53D,0x1D53E, // D E F G
      0x210D,                            // H → ℍ
      0x1D540,0x1D541,0x1D542,0x1D543, // I J K L
      0x1D544,                           // M
      0x2115,                            // N → ℕ
      0x1D546,                           // O
      0x2119,                            // P → ℙ
      0x211A,                            // Q → ℚ
      0x211D,                            // R → ℝ
      0x1D54A,0x1D54B,0x1D54C,          // S T U
      0x1D54D,0x1D54E,0x1D54F,0x1D550, // V W X Y
      0x2124                             // Z → ℤ
    ];
    const digits = [
      0x1D7D8,0x1D7D9,0x1D7DA,0x1D7DB,0x1D7DC, // 0-4
      0x1D7DD,0x1D7DE,0x1D7DF,0x1D7E0,0x1D7E1  // 5-9
    ];
    return [...text].map(ch => {
      const c = ch.charCodeAt(0);
      if (ch >= 'a' && ch <= 'z') return cp(0x1D552 + c - 97); // no exceptions
      if (ch >= 'A' && ch <= 'Z') return cp(upperMap[c - 65]);
      if (ch >= '0' && ch <= '9') return cp(digits[c - 48]);
      return ch;
    }).join('');
  }
}
```
Preview: 𝔸𝕝𝕘𝕖𝕓𝕣𝕒 𝕝𝕖𝕥𝕥𝕖𝕣𝕤

---

## Notes

- All styles pass through spaces and punctuation unchanged — only a–z, A–Z, and 0–9 are transformed.
- Underline and Strikethrough use Unicode combining characters (U+0332 / U+0336) which attach to every character including spaces and punctuation. This is expected behavior.
- The `cp()` helper (`String.fromCodePoint(n)`) is already defined at the top of the script block in `index.html`.
