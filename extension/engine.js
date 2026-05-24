/* UniStyle - Shared Engine
 *
 * Single source of truth for all Unicode style transforms, used by both
 * the web app (index.html) and the browser extension (popup).
 *
 * Exposed on window/globalThis:
 *   STYLES, STYLES_MAP   - array + lookup of all 22 styles
 *   formatSentences      - primary "clean up" transform
 *   stripUnicode         - convert fancy Unicode back to ASCII
 *   zalgoText            - combining-mark stacker (used inside STYLES too)
 *   cp, mapRange         - helpers
 *
 * When updating the engine, edit THIS FILE ONLY. The extension folder
 * keeps a copy - sync it with `copy engine.js ..\unistyle-extension\`.
 */
'use strict';

/* ── Helpers ──────────────────────────────────────────── */
const cp = n => String.fromCodePoint(n);

function mapRange(text, ucBase, lcBase, dgBase) {
  return [...text].map(ch => {
    const c = ch.charCodeAt(0);
    if (ch >= 'A' && ch <= 'Z') return cp(ucBase + c - 65);
    if (ch >= 'a' && ch <= 'z') return cp(lcBase + c - 97);
    if (dgBase != null && ch >= '0' && ch <= '9') return cp(dgBase + c - 48);
    return ch;
  }).join('');
}

/* Grapheme-aware iteration. Uses Intl.Segmenter where available so that ZWJ
 * sequences (👨‍👩‍👧), skin-tone modifiers (👍🏽), and emoji with variation
 * selectors (❤️) are visited as ONE unit. Falls back to code-point iteration
 * for old browsers. Used by transforms that append combining marks - those
 * marks break ZWJ joining when applied between each code point of a sequence. */
const _seg = (typeof Intl !== 'undefined' && Intl.Segmenter)
  ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  : null;
function graphemes(text) {
  if (_seg) return Array.from(_seg.segment(text), s => s.segment);
  return [...text];
}
/* Returns true if a grapheme is an emoji / pictograph / regional indicator
 * that should NOT receive combining marks (they'd break the visible glyph). */
const _emojiRe = /\p{Extended_Pictographic}|\p{Emoji_Component}|\p{Regional_Indicator}/u;
const isEmojiGrapheme = g => g.length > 1 || _emojiRe.test(g);

/* ── Exception maps ───────────────────────────────────── */
const SCRIPT_LOWER = [
  0x1D4B6,0x1D4B7,0x1D4B8,0x1D4B9,
  0x212F,0x1D4BB,0x210A,
  0x1D4BD,0x1D4BE,0x1D4BF,
  0x1D4C0,0x1D4C1,0x1D4C2,0x1D4C3,
  0x2134,
  0x1D4C5,0x1D4C6,0x1D4C7,0x1D4C8,
  0x1D4C9,0x1D4CA,0x1D4CB,0x1D4CC,
  0x1D4CD,0x1D4CE,0x1D4CF
];
const SCRIPT_UPPER = [
  0x1D49C,0x212C,0x1D49E,0x1D49F,
  0x2130,0x2131,0x1D4A2,0x210B,0x2110,
  0x1D4A5,0x1D4A6,0x2112,0x2133,
  0x1D4A9,0x1D4AA,0x1D4AB,0x1D4AC,
  0x211B,
  0x1D4AE,0x1D4AF,0x1D4B0,
  0x1D4B1,0x1D4B2,0x1D4B3,0x1D4B4,
  0x1D4B5
];
const FRAKTUR_UPPER = [
  0x1D504,0x1D505,0x212D,
  0x1D507,0x1D508,0x1D509,0x1D50A,
  0x210C,0x2111,
  0x1D50D,0x1D50E,0x1D50F,
  0x1D510,0x1D511,0x1D512,0x1D513,
  0x1D514,0x211C,
  0x1D516,0x1D517,0x1D518,
  0x1D519,0x1D51A,0x1D51B,0x1D51C,
  0x2128
];
const DS_UPPER = [
  0x1D538,0x1D539,0x2102,
  0x1D53B,0x1D53C,0x1D53D,0x1D53E,
  0x210D,
  0x1D540,0x1D541,0x1D542,0x1D543,
  0x1D544,0x2115,0x1D546,
  0x2119,0x211A,0x211D,
  0x1D54A,0x1D54B,0x1D54C,
  0x1D54D,0x1D54E,0x1D54F,0x1D550,
  0x2124
];

const SMALL_CAPS = {
  'a':'ᴀ','b':'ʙ','c':'ᴄ','d':'ᴅ','e':'ᴇ','f':'ꜰ','g':'ɢ','h':'ʜ',
  'i':'ɪ','j':'ᴊ','k':'ᴋ','l':'ʟ','m':'ᴍ','n':'ɴ','o':'ᴏ','p':'ᴘ',
  'q':'Q','r':'ʀ','s':'ꜱ','t':'ᴛ','u':'ᴜ','v':'ᴠ','w':'ᴡ','x':'x',
  'y':'ʏ','z':'ᴢ'
};

const UPSIDE_DOWN = {
  'a':'ɐ','b':'q','c':'ɔ','d':'p','e':'ǝ','f':'ɟ','g':'ƃ','h':'ɥ',
  'i':'ᴉ','j':'ɾ','k':'ʞ','l':'ʅ','m':'ɯ','n':'u','o':'o','p':'d',
  'q':'b','r':'ɹ','s':'s','t':'ʇ','u':'n','v':'ʌ','w':'ʍ','x':'x',
  'y':'ʎ','z':'z',
  'A':'∀','B':'ᗺ','C':'Ɔ','D':'ᗡ','E':'Ǝ','F':'Ⅎ','G':'פ','H':'H',
  'I':'I','J':'ɾ','K':'ʞ','L':'⅂','M':'W','N':'N','O':'O','P':'d',
  'Q':'Q','R':'ɹ','S':'S','T':'⊥','U':'∩','V':'Λ','W':'M','X':'X',
  'Y':'ʎ','Z':'Z',
  '0':'0','1':'⇂','2':'ᄅ','3':'Ɛ','4':'ᔭ','5':'ϛ','6':'9','7':'L',
  '8':'8','9':'6','?':'¿','!':'¡','.':'˙'
};

const ZALGO_ABOVE = [0x300,0x301,0x302,0x303,0x304,0x305,0x306,0x307,0x308,0x309,
  0x30A,0x30B,0x30C,0x30D,0x30E,0x30F,0x310,0x311,0x312,0x313,0x314,0x315];
const ZALGO_BELOW = [0x316,0x317,0x318,0x319,0x31A,0x31B,0x31C,0x31D,0x31E,0x31F,
  0x320,0x321,0x322,0x323,0x324,0x325,0x326,0x327,0x328];

function zalgoText(text, level) {
  const maxA = [2, 4, 8][level - 1] || 2;
  const maxB = [1, 3, 5][level - 1] || 1;
  const pick = arr => cp(arr[Math.floor(Math.random() * arr.length)]);
  const rnd  = (arr, max) => Array.from({length: Math.floor(Math.random() * max) + 1}, () => pick(arr)).join('');
  return graphemes(text).map(g => {
    if (g === ' ' || g === '\n' || g === '\t') return g;
    if (isEmojiGrapheme(g)) return g;          // skip combining marks on emoji - breaks ZWJ sequences
    return g + rnd(ZALGO_ABOVE, maxA) + rnd(ZALGO_BELOW, maxB);
  }).join('');
}

/* ── Strip-Unicode map ────────────────────────────────── */
const STRIP_MAP = (() => {
  const m = {};
  const add = (base, asciiBase, count) => {
    for (let i = 0; i < count; i++) m[cp(base + i)] = String.fromCharCode(asciiBase + i);
  };
  add(0x1D400,65,26); add(0x1D41A,97,26); add(0x1D7CE,48,10);
  add(0x1D434,65,26); add(0x1D44E,97,26); m['ℎ']='h';
  add(0x1D468,65,26); add(0x1D482,97,26);
  add(0x1D5D4,65,26); add(0x1D5EE,97,26); add(0x1D7EC,48,10);
  add(0x1D608,65,26); add(0x1D622,97,26);
  add(0x1D63C,65,26); add(0x1D656,97,26);
  add(0x1D670,65,26); add(0x1D68A,97,26); add(0x1D7F6,48,10);
  SCRIPT_UPPER.forEach((c,i) => { m[cp(c)] = String.fromCharCode(65+i); });
  SCRIPT_LOWER.forEach((c,i) => { m[cp(c)] = String.fromCharCode(97+i); });
  FRAKTUR_UPPER.forEach((c,i) => { m[cp(c)] = String.fromCharCode(65+i); });
  add(0x1D51E,97,26);
  DS_UPPER.forEach((c,i) => { m[cp(c)] = String.fromCharCode(65+i); });
  add(0x1D552,97,26); add(0x1D7D8,48,10);
  for (let i=0;i<94;i++) m[cp(0xFF01+i)] = String.fromCharCode(0x21+i);
  m['　']=' ';
  Object.entries(SMALL_CAPS).forEach(([a,sc]) => { m[sc]=a; });
  add(0x24B6,65,26); add(0x24D0,97,26);
  m['⓪']='0';
  for (let i=1;i<=9;i++) m[cp(0x2460+i-1)]=String(i);
  Object.entries(UPSIDE_DOWN).forEach(([a,ud]) => { if (!m[ud]) m[ud]=a; });
  return m;
})();

function stripUnicode(text) {
  let r = text.replace(/[̀-ͯ]/g, '');
  return [...r].map(ch => STRIP_MAP[ch] || ch).join('');
}

/* ── Styles ───────────────────────────────────────────── */
const STYLES = [
  {
    key:'bold', label:'Bold', compat:{d:2,t:2,n:2,s:0},
    tip:'Mathematical bold — copies as actual bold Unicode characters into Discord, Slack, Notion, X/Twitter, and anywhere that renders Unicode.',
    fn: t => mapRange(t,0x1D400,0x1D41A,0x1D7CE)
  },
  {
    key:'italic', label:'Italic', compat:{d:2,t:2,n:2,s:0},
    tip:'Mathematical italic — works anywhere Unicode renders, including social media profiles and bios where Markdown italic is stripped.',
    fn: t => [...t].map(ch => {
      if (ch==='h') return 'ℎ';
      const c=ch.charCodeAt(0);
      if (ch>='A'&&ch<='Z') return cp(0x1D434+c-65);
      if (ch>='a'&&ch<='z') return cp(0x1D44E+c-97);
      return ch;
    }).join('')
  },
  {
    key:'bolditalic', label:'Bold Italic', compat:{d:2,t:2,n:2,s:0},
    tip:'Bold and italic combined — great for strong emphasis in plain-text environments that strip real Markdown formatting.',
    fn: t => mapRange(t,0x1D468,0x1D482)
  },
  {
    key:'boldsans', label:'Bold Sans', compat:{d:2,t:2,n:2,s:0},
    tip:'Bold sans-serif — the same style WhatsApp renders for **bold** text, but as real Unicode so it works everywhere.',
    fn: t => mapRange(t,0x1D5D4,0x1D5EE,0x1D7EC)
  },
  {
    key:'italicsans', label:'Italic Sans', compat:{d:2,t:2,n:2,s:0},
    tip:'Italic sans-serif — a clean slanted look that survives copy-paste across apps without losing its style.',
    fn: t => mapRange(t,0x1D608,0x1D622)
  },
  {
    key:'boldisans', label:'Bold Italic Sans', compat:{d:2,t:2,n:2,s:0},
    tip:'Bold italic sans-serif — maximum weight and angle. Useful for headings or dramatic emphasis in profiles and bios.',
    fn: t => mapRange(t,0x1D63C,0x1D656)
  },
  {
    key:'under', label:'Underline', compat:{d:2,t:2,n:1,s:0},
    tip:'Unicode combining underline (U+0332) attaches to every character. Renders in most modern apps — may appear inconsistent in Notion. Emoji pass through unmarked.',
    fn: t => graphemes(t).map(g => isEmojiGrapheme(g) ? g : g + '̲').join('')
  },
  {
    key:'strike', label:'Strikethrough', compat:{d:2,t:2,n:1,s:0},
    tip:'Unicode combining strikethrough (U+0336) — works in any Unicode-aware app, unlike ~~Markdown~~ which only works in a few. Emoji pass through unmarked.',
    fn: t => graphemes(t).map(g => isEmojiGrapheme(g) ? g : g + '̶').join('')
  },
  {
    key:'mono', label:'Monospace', compat:{d:2,t:2,n:2,s:0},
    tip:'Mathematical monospace — looks like code. Great for technical content, usernames, or a retro terminal aesthetic.',
    fn: t => mapRange(t,0x1D670,0x1D68A,0x1D7F6)
  },
  {
    key:'script', label:'Script', compat:{d:2,t:2,n:2,s:0},
    tip:'Mathematical script / cursive — decorative and elegant. Popular for names, quotes, and creative writing.',
    fn: t => [...t].map(ch => {
      const c=ch.charCodeAt(0);
      if (ch>='a'&&ch<='z') return cp(SCRIPT_LOWER[c-97]);
      if (ch>='A'&&ch<='Z') return cp(SCRIPT_UPPER[c-65]);
      return ch;
    }).join('')
  },
  {
    key:'fraktur', label:'Fraktur', compat:{d:2,t:2,n:1,s:0},
    tip:'Mathematical Fraktur / Gothic — medieval blackletter style. Popular in metal, occult, and vintage-inspired aesthetics.',
    fn: t => [...t].map(ch => {
      const c=ch.charCodeAt(0);
      if (ch>='a'&&ch<='z') return cp(0x1D51E+c-97);
      if (ch>='A'&&ch<='Z') return cp(FRAKTUR_UPPER[c-65]);
      return ch;
    }).join('')
  },
  {
    key:'dblstruck', label:'Double Struck', compat:{d:2,t:2,n:2,s:0},
    tip:'Blackboard bold — used in math for real numbers (ℝ), integers (ℤ), naturals (ℕ). Also popular as a decorative style in bios.',
    fn: t => [...t].map(ch => {
      const c=ch.charCodeAt(0);
      if (ch>='a'&&ch<='z') return cp(0x1D552+c-97);
      if (ch>='A'&&ch<='Z') return cp(DS_UPPER[c-65]);
      if (ch>='0'&&ch<='9') return cp(0x1D7D8+c-48);
      return ch;
    }).join('')
  },
  {
    key:'fullwidth', label:'Vaporwave', compat:{d:2,t:2,n:2,s:1},
    tip:'Ｆｕｌｌ－ｗｉｄｔｈ Unicode — the "aesthetic" style popular in bios and art posts. Also called wide text.',
    fn: t => [...t].map(ch => {
      const c=ch.charCodeAt(0);
      if (c===0x20) return '　';
      if (c>=0x21&&c<=0x7E) return cp(c+0xFEE0);
      return ch;
    }).join('')
  },
  {
    key:'smallcaps', label:'Small Caps', compat:{d:2,t:2,n:2,s:1},
    tip:'sᴍᴀʟʟ ᴄᴀᴘs — dedicated Unicode small-capital codepoints. Readable and polished for headers, titles, and bios.',
    fn: t => [...t].map(ch=>SMALL_CAPS[ch.toLowerCase()]||ch).join('')
  },
  {
    key:'bubble', label:'Bubble', compat:{d:2,t:2,n:2,s:1},
    tip:'Ⓛⓔⓣⓣⓔⓡⓢ enclosed in open-circle Unicode characters. Popular for decorative lists, bios, and standings.',
    fn: t => [...t].map(ch => {
      const c=ch.charCodeAt(0);
      if (ch>='A'&&ch<='Z') return cp(0x24B6+c-65);
      if (ch>='a'&&ch<='z') return cp(0x24D0+c-97);
      if (ch==='0') return '⓪';
      if (ch>='1'&&ch<='9') return cp(0x2460+c-49);
      return ch;
    }).join('')
  },
  {
    key:'upsidedown', label:'Upside Down', compat:{d:2,t:2,n:2,s:1},
    tip:'ʇxǝʇ uʍop ǝpᴉsdn — each character is swapped with its rotated Unicode equivalent and the string is reversed.',
    fn: t => [...t].reverse().map(ch=>UPSIDE_DOWN[ch]||ch).join('')
  },
  {
    key:'reverse', label:'Reverse', compat:{d:2,t:2,n:2,s:2},
    tip:'Reverses character order. Pairs well with other styles — try it in the Style Combiner below.',
    fn: t => [...t].reverse().join('')
  },
  {
    key:'altcase', label:'Alternating', compat:{d:2,t:2,n:2,s:2},
    tip:'tHiS iS aLtErNaTiNg CaSe — spaces and punctuation are skipped, only letters alternate. Pure ASCII, works everywhere.',
    fn: t => {
      let i=0;
      return [...t].map(ch => {
        if (/[a-zA-Z]/.test(ch)) return (i++%2===0) ? ch.toLowerCase() : ch.toUpperCase();
        return ch;
      }).join('');
    }
  },
  {
    key:'zalgo', label:'Zalgo', compat:{d:2,t:1,n:0,s:0},
    tip:'S̷t̸a̵c̶k̸s̵ random Unicode combining marks on each character. Adjust the intensity slider from subtle to full chaos.',
    hasSlider: true,
    fn: (t, level) => zalgoText(t, level||1)
  },
  {
    key:'subscript', label:'Subscript', compat:{d:2,t:2,n:2,s:0},
    tip:'Subscript Unicode (H₂O, x₁). Letter coverage is partial because Unicode does not define a full subscript alphabet. Unsupported letters pass through unchanged.',
    fn: t => {
      const subDigits = '₀₁₂₃₄₅₆₇₈₉';
      const subLetters = {
        a:'ₐ', e:'ₑ', h:'ₕ', i:'ᵢ', j:'ⱼ', k:'ₖ', l:'ₗ', m:'ₘ', n:'ₙ',
        o:'ₒ', p:'ₚ', r:'ᵣ', s:'ₛ', t:'ₜ', u:'ᵤ', v:'ᵥ', x:'ₓ',
        '+':'₊', '-':'₋', '=':'₌', '(':'₍', ')':'₎'
      };
      return [...t].map(ch => {
        if (ch >= '0' && ch <= '9') return subDigits[ch.charCodeAt(0) - 48];
        return subLetters[ch.toLowerCase()] || ch;
      }).join('');
    }
  },
  {
    key:'superscript', label:'Superscript', compat:{d:2,t:2,n:2,s:0},
    tip:'Superscript Unicode (x², 1ˢᵗ, footnote¹). Letter coverage is partial because Unicode does not define a full superscript alphabet. Unsupported letters pass through unchanged.',
    fn: t => {
      const supDigits = '⁰¹²³⁴⁵⁶⁷⁸⁹';
      const supLetters = {
        a:'ᵃ', b:'ᵇ', c:'ᶜ', d:'ᵈ', e:'ᵉ', f:'ᶠ', g:'ᵍ', h:'ʰ', i:'ⁱ',
        j:'ʲ', k:'ᵏ', l:'ˡ', m:'ᵐ', n:'ⁿ', o:'ᵒ', p:'ᵖ', r:'ʳ', s:'ˢ',
        t:'ᵗ', u:'ᵘ', v:'ᵛ', w:'ʷ', x:'ˣ', y:'ʸ', z:'ᶻ',
        A:'ᴬ', B:'ᴮ', D:'ᴰ', E:'ᴱ', G:'ᴳ', H:'ᴴ', I:'ᴵ', J:'ᴶ', K:'ᴷ',
        L:'ᴸ', M:'ᴹ', N:'ᴺ', O:'ᴼ', P:'ᴾ', R:'ᴿ', T:'ᵀ', U:'ᵁ', V:'ⱽ',
        W:'ᵂ',
        '+':'⁺', '-':'⁻', '=':'⁼', '(':'⁽', ')':'⁾'
      };
      return [...t].map(ch => {
        if (ch >= '0' && ch <= '9') return supDigits[ch.charCodeAt(0) - 48];
        return supLetters[ch] || ch;
      }).join('');
    }
  },
  {
    key:'flags', label:'Regional Indicator', compat:{d:2,t:2,n:2,s:1},
    tip:'Type 2-letter ISO country codes to render flags. US becomes 🇺🇸, FR becomes 🇫🇷, JP becomes 🇯🇵. Single letters render as regional indicator letters without a flag.',
    fn: t => [...t].map(ch => {
      const c = ch.toUpperCase().charCodeAt(0);
      if (c >= 65 && c <= 90) return String.fromCodePoint(0x1F1E6 + c - 65);
      return ch;
    }).join('')
  }
];

/* Styles lookup map (O(1) key → style object) */
const STYLES_MAP = Object.fromEntries(STYLES.map(s => [s.key, s]));

/* ── Format Sentences ────────────────────────────────── */
function formatSentences(text) {
  const saved=[], save=m=>{saved.push(m);return '\x01'+(saved.length-1)+'\x01';};
  let s=text
    .replace(/https?:\/\/[^\s]+/gi,save)
    .replace(/www\.[^\s]+/gi,save)
    .replace(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,save)
    .replace(/@[a-zA-Z0-9_]+/g,save)
    .replace(/\b(?:[a-zA-Z0-9][a-zA-Z0-9-]*\.)+(?:com|net|org|edu|gov|mil|int|biz|info|io|co|app|dev|ai|me|tv|us|uk|ca|au|de|fr|it|es|ru|jp|cn|br|mx|in|nz|se|no|dk|nl|be|ch|at|pl|pt|gr|sg|hk|za|ng|ar|html|htm|pdf|js|ts|css|json|xml|txt|md|py|rb|php|java|go|svg|png|jpg|jpeg|gif|mp4|mp3|zip|tar|gz|csv|sql|sh|bat|yml|yaml|toml|cfg|conf|log|docx|xlsx|pptx)(?=[^a-zA-Z0-9-]|$)/gi,save);
  s=s.replace(/[^\S\n]+/g,' ');
  s=s.replace(/ ([.?!,;:])/g,'$1');
  s=s.replace(/([.?!])([A-Za-z\x01])/g,'$1 $2');
  s=s.replace(/([,;:])([^\s\n])/g,'$1 $2');
  s=s.replace(/^[ \t]*([a-z])/,c=>c.toUpperCase());
  s=s.replace(/([.?!][ \t]+)([a-z])/g,(_,p,c)=>p+c.toUpperCase());
  s=s.replace(/\n[ \t]*([a-z])/g,(_,c)=>'\n'+c.toUpperCase());
  s=s.replace(/\x01(\d+)\x01/g,(_,i)=>saved[+i]);
  return s.trim();
}
