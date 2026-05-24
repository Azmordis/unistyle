/* UniStyle - popup logic
 *
 * The engine (STYLES, formatSentences, stripUnicode, helpers) lives in
 * engine.js and is loaded by popup.html as a separate <script> tag.
 * engine.js is shared verbatim with the web app - DO NOT redefine its
 * exports here.
 */
'use strict';

/* Persist keys */
const STORAGE_KEY = 'tf-popup-input';
const ZALGO_LEVEL_KEY = 'tf-popup-zalgo';

/* Favorites — these are the styles that show up in the right-click panel.
   Default set covers the most-used Unicode styles so day-one users see
   something useful in the panel without configuring anything. */
const FAVS_KEY = 'tf-favs';
const DEFAULT_FAVS = ['bold', 'italic', 'strike', 'under', 'smallcaps', 'fullwidth', 'upsidedown'];
let favorites = new Set(DEFAULT_FAVS);

/* Special chars (lifted from index.html, lightly compacted) */
const SPECIAL_CHARS = [
  ['—','Em dash'],
  ['–','En dash'],
  ['…','Ellipsis'],
  ['“','Left double quote'],
  ['”','Right double quote'],
  ['‘','Left single quote'],
  ['’','Right single quote / apostrophe'],
  ['©','Copyright'],
  ['®','Registered'],
  ['™','Trademark'],
  ['°','Degree'],
  ['•','Bullet'],
  ['→','Right arrow'],
  ['←','Left arrow'],
  ['↑','Up arrow'],
  ['↓','Down arrow'],
  ['★','Star'],
  ['♥','Heart'],
  ['≠','Not equal'],
  ['≈','Approximately equal'],
  ['±','Plus or minus'],
  ['×','Multiplication'],
  ['÷','Division'],
  ['∞','Infinity'],
  ['π','Pi']
];

function toTitleCase(text) {
  return text.replace(/\b([a-z])([a-z]*)/gi, (_, a, b) => a.toUpperCase() + b.toLowerCase());
}

/* ── DOM refs ─────────────────────────────────────── */
const inputEl       = document.getElementById('inputText');
const outputList    = document.getElementById('outputList');
const formatBtn     = document.getElementById('formatBtn');
const clearBtn      = document.getElementById('clearBtn');
const capsBtn       = document.getElementById('capsBtn');
const lowerBtn      = document.getElementById('lowerBtn');
const titleBtn      = document.getElementById('titleBtn');
const stripBtn      = document.getElementById('stripBtn');
const charsToggle   = document.getElementById('charsToggle');
const specialCharsRow = document.getElementById('specialCharsRow');
const charCounter   = document.getElementById('charCounter');
const styleSearch   = document.getElementById('styleSearch');
const srAnnounce    = document.getElementById('sr-announce');
const fullAppLink   = document.getElementById('fullAppLink');

const outputEls = {};       // key → { row, preview, copyBtn }
let zalgoSliderEl = null;   // inline range input for the zalgo card
let zalgoLevel = parseInt(localStorage.getItem(ZALGO_LEVEL_KEY) || '1', 10);
if (![1, 2, 3].includes(zalgoLevel)) zalgoLevel = 1;

/* Build the style rows once, then update text in place on input. */
function buildRows() {
  const frag = document.createDocumentFragment();
  for (const style of STYLES) {
    const row = document.createElement('div');
    row.className = 'style-card';
    row.setAttribute('role', 'listitem');
    row.dataset.key = style.key;

    const meta = document.createElement('div');
    meta.className = 'style-meta';

    const labelRow = document.createElement('div');
    labelRow.className = 'style-label-row';

    const label = document.createElement('span');
    label.className = 'style-label';
    label.textContent = style.label;
    labelRow.appendChild(label);

    if (style.hasSlider) {
      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = '1';
      slider.max = '3';
      slider.step = '1';
      slider.value = String(zalgoLevel);
      slider.className = 'zalgo-slider';
      slider.title = 'Zalgo intensity (1=subtle, 3=chaos)';
      slider.setAttribute('aria-label', 'Zalgo intensity');
      slider.addEventListener('input', () => {
        zalgoLevel = parseInt(slider.value, 10);
        localStorage.setItem(ZALGO_LEVEL_KEY, String(zalgoLevel));
        renderOne(style);
      });
      zalgoSliderEl = slider;
      labelRow.appendChild(slider);
    }

    const preview = document.createElement('div');
    preview.className = 'style-preview';
    preview.textContent = '';

    meta.appendChild(labelRow);
    meta.appendChild(preview);

    const starBtn = document.createElement('button');
    starBtn.className = 'star-btn';
    starBtn.type = 'button';
    starBtn.dataset.key = style.key;
    starBtn.title = 'Show this style in the right-click panel';
    updateStarBtn(starBtn, favorites.has(style.key));

    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-btn';
    copyBtn.type = 'button';
    copyBtn.textContent = 'Copy';
    copyBtn.dataset.key = style.key;
    copyBtn.setAttribute('aria-label', `Copy ${style.label}`);

    row.appendChild(meta);
    row.appendChild(starBtn);
    row.appendChild(copyBtn);
    frag.appendChild(row);

    outputEls[style.key] = { row, preview, copyBtn, starBtn };
  }
  outputList.appendChild(frag);
}

/* Update star button visual + ARIA state. */
function updateStarBtn(btn, on) {
  btn.textContent = on ? '★' : '☆';
  btn.classList.toggle('on', on);
  btn.setAttribute('aria-pressed', String(on));
  btn.setAttribute('aria-label', on ? 'Remove from right-click panel' : 'Add to right-click panel');
}

/* Toggle a style's favorite state and persist. */
async function toggleFavorite(key) {
  if (favorites.has(key)) favorites.delete(key);
  else favorites.add(key);
  // Update the button immediately for snappy feedback
  const els = outputEls[key];
  if (els) updateStarBtn(els.starBtn, favorites.has(key));
  // Persist to sync storage so the panel (content script) sees it
  try {
    await chrome.storage.sync.set({ [FAVS_KEY]: [...favorites] });
  } catch (e) {
    console.warn('[TextFormatter] could not save favorites:', e);
  }
}

/* Render preview for a single style (used by zalgo slider). */
function renderOne(style) {
  const els = outputEls[style.key];
  if (!els) return;
  const text = inputEl.value;
  els.preview.textContent = text ? runStyle(style, text) : '';
}

/* Render all previews. */
function render() {
  const text = inputEl.value;
  for (const style of STYLES) {
    const els = outputEls[style.key];
    if (!els) continue;
    els.preview.textContent = text ? runStyle(style, text) : '';
  }
  updateCounter(text);
  localStorage.setItem(STORAGE_KEY, text);
}

/* Wrapper that passes the zalgo level when the style needs it. */
function runStyle(style, text) {
  if (style.hasSlider) return style.fn(text, zalgoLevel);
  return style.fn(text);
}

function updateCounter(text) {
  const chars = text.length;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  charCounter.textContent = `${chars} chars · ${words} words`;
}

/* Copy handler. navigator.clipboard works in extension popups under a
   user gesture without any declared permission in MV3. */
async function handleCopy(btn) {
  const key = btn.dataset.key;
  const style = STYLES_MAP[key];
  if (!style) return;
  const text = inputEl.value;
  if (!text) {
    srAnnounce.textContent = 'Nothing to copy';
    return;
  }
  const out = runStyle(style, text);
  try {
    await navigator.clipboard.writeText(out);
    // F15 (v1.6.0): persist this as the last-used style so the
    // Ctrl+Shift+U inline hotkey re-applies it on the next page.
    try { chrome.storage.local.set({ 'unistyle-last-used-style': key }); } catch (_) {}
    btn.textContent = 'Copied';
    btn.classList.add('copied');
    srAnnounce.textContent = `${style.label} copied`;
    setTimeout(() => {
      btn.textContent = 'Copy';
      btn.classList.remove('copied');
    }, 1100);
  } catch (e) {
    srAnnounce.textContent = 'Copy failed';
    btn.textContent = 'Error';
    setTimeout(() => { btn.textContent = 'Copy'; }, 1100);
  }
}

/* Replace the textarea with a transform applied to its current value. */
function applyTransform(fn) {
  inputEl.value = fn(inputEl.value);
  render();
  inputEl.focus();
}

/* Insert a special char at the current caret position. */
function insertAtCaret(ch) {
  const start = inputEl.selectionStart ?? inputEl.value.length;
  const end   = inputEl.selectionEnd   ?? inputEl.value.length;
  const v = inputEl.value;
  inputEl.value = v.slice(0, start) + ch + v.slice(end);
  const pos = start + ch.length;
  inputEl.focus();
  inputEl.setSelectionRange(pos, pos);
  render();
}

/* Build the special-chars buttons. */
function buildSpecialChars() {
  const frag = document.createDocumentFragment();
  for (const [ch, label] of SPECIAL_CHARS) {
    const b = document.createElement('button');
    b.className = 'btn-special';
    b.type = 'button';
    b.textContent = ch;
    b.dataset.char = ch;
    b.title = label;
    frag.appendChild(b);
  }
  specialCharsRow.appendChild(frag);
}

/* Live search filtering on the style list. */
function applySearch(q) {
  const needle = q.trim().toLowerCase();
  for (const style of STYLES) {
    const els = outputEls[style.key];
    if (!els) continue;
    const hit = !needle || style.label.toLowerCase().includes(needle);
    els.row.classList.toggle('hidden', !hit);
  }
}

/* Open the full web app in a new tab (extension popups can't navigate). */
fullAppLink.addEventListener('click', e => {
  e.preventDefault();
  chrome.tabs.create({ url: 'https://unistyle.io' });
});

/* ── Event wiring ─────────────────────────────────── */

inputEl.addEventListener('input', render);

formatBtn.addEventListener('click', () => {
  applyTransform(formatSentences);
  // F15 (v1.6.0): persist for the inline hotkey
  try { chrome.storage.local.set({ 'unistyle-last-used-style': 'format-sentences' }); } catch (_) {}
});
clearBtn.addEventListener('click',  () => {
  inputEl.value = '';
  render();
  inputEl.focus();
});
capsBtn .addEventListener('click',  () => applyTransform(t => t.toUpperCase()));
lowerBtn.addEventListener('click',  () => applyTransform(t => t.toLowerCase()));
titleBtn.addEventListener('click',  () => applyTransform(toTitleCase));
stripBtn.addEventListener('click',  () => applyTransform(stripUnicode));

charsToggle.addEventListener('click', () => {
  const open = specialCharsRow.classList.toggle('open');
  charsToggle.setAttribute('aria-expanded', String(open));
  charsToggle.textContent = open ? 'Chars ▴' : 'Chars ▾';
});

specialCharsRow.addEventListener('click', e => {
  const b = e.target.closest('.btn-special');
  if (!b) return;
  insertAtCaret(b.dataset.char);
});

outputList.addEventListener('click', e => {
  const star = e.target.closest('.star-btn');
  if (star) { toggleFavorite(star.dataset.key); return; }
  const b = e.target.closest('.copy-btn');
  if (!b) return;
  handleCopy(b);
});

styleSearch.addEventListener('input', e => applySearch(e.target.value));

/* Stamp the version label from manifest so it stays in sync. */
try {
  const ver = chrome.runtime.getManifest().version;
  const verEl = document.getElementById('versionLabel');
  if (verEl) verEl.textContent = `v${ver}`;
} catch (_) { /* ignore — non-extension contexts */ }

/* Load favorites from chrome.storage.sync. If nothing's stored yet,
   seed with the defaults so the right-click panel shows useful styles
   on day one. */
async function loadFavorites() {
  try {
    const data = await chrome.storage.sync.get(FAVS_KEY);
    const stored = data && data[FAVS_KEY];
    if (Array.isArray(stored)) {
      favorites = new Set(stored);
    } else {
      // First run — persist the defaults so the panel sees them too
      favorites = new Set(DEFAULT_FAVS);
      await chrome.storage.sync.set({ [FAVS_KEY]: [...favorites] });
    }
  } catch (e) {
    console.warn('[TextFormatter] could not load favorites:', e);
  }
}

/* React to favorites changes made elsewhere (e.g. another window). */
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync' || !changes[FAVS_KEY]) return;
  const fresh = changes[FAVS_KEY].newValue;
  if (!Array.isArray(fresh)) return;
  favorites = new Set(fresh);
  for (const style of STYLES) {
    const els = outputEls[style.key];
    if (els && els.starBtn) updateStarBtn(els.starBtn, favorites.has(style.key));
  }
});

/* ── Init ─────────────────────────────────────────── */
(async () => {
  await loadFavorites();
  buildSpecialChars();
  buildRows();
  // Restore persisted input
  const savedInput = localStorage.getItem(STORAGE_KEY);
  if (savedInput) inputEl.value = savedInput;
  render();
  inputEl.focus();
  inputEl.setSelectionRange(inputEl.value.length, inputEl.value.length);
})();
