/* UniStyle - Content script (Phase 2 + Phase 3)
 *
 * Listens for a "tf-show-panel" message from the background service
 * worker (which fires when the user picks "Format with UniStyle"
 * from the right-click menu), then renders a floating panel attached
 * to a closed shadow root so the host page's CSS can't bleed in.
 *
 * Each style row offers two actions:
 *   - Copy:    write the formatted text to the clipboard (works anywhere)
 *   - Replace: swap the highlighted text on the page with the formatted
 *              version (only works in inputs, textareas, and
 *              contenteditable elements - disabled with a tooltip on
 *              read-only text).
 *
 * The engine (STYLES, formatSentences, stripUnicode, helpers) is loaded
 * by background.js immediately before this script (same executeScript
 * call lists engine.js first, then content.js), so it's already on
 * globalThis by the time we run.
 */
(() => {
  'use strict';

  /* Avoid double-injecting helpers if the script is loaded twice
     (frames, history navigations, on-demand inject by background). */
  if (window.__tfContentLoaded) return;
  window.__tfContentLoaded = true;

  const HOST_ID = '__tf-shadow-host';
  const TOAST_HOST_ID = '__tf-toast-host';
  const FAVS_KEY = 'tf-favs';
  /* F15 (v1.6.0): persists the most recently applied style so the
     inline-hotkey transform (Ctrl+Shift+U) knows which style to use.
     Written by: panel Copy/Replace clicks, popup style Copy clicks,
     and the cleanup section's Format Sentences action. Default 'bold'
     applies if storage is empty (first install).
     Pseudo-key 'format-sentences' indicates the engine's formatSentences
     cleanup function rather than a STYLES_MAP entry. */
  const LAST_USED_KEY = 'unistyle-last-used-style';
  /* Mirror of popup.js defaults — kept identical so first-run behaviour
     matches whether the popup or the panel runs first. */
  const DEFAULT_FAVS = ['bold', 'italic', 'strike', 'under', 'smallcaps', 'fullwidth', 'upsidedown'];

  /* ── State ───────────────────────────────────────── */
  let panelHost = null;   // outer host element in the page DOM
  let panelRoot = null;   // shadow root
  let panelText = '';     // current selection text the panel was opened with
  let escListener = null;
  let outsideListener = null;
  /* Snapshot of where the highlighted text lives, captured BEFORE we
     build the panel so we can put the new text back in the right place
     when Replace is clicked. Shape:
       { kind: 'input',           el, start, end }
       { kind: 'contenteditable', el, range }
       { kind: 'readonly',        reason }   (no target)            */
  let target = null;

  /* Resolve which styles to show in the panel from chrome.storage.sync. */
  async function getFavoriteStyles() {
    try {
      const data = await chrome.storage.sync.get(FAVS_KEY);
      const stored = data && data[FAVS_KEY];
      const keys = Array.isArray(stored) && stored.length ? stored : DEFAULT_FAVS;
      const keySet = new Set(keys);
      const filtered = STYLES.filter(s => keySet.has(s.key));
      // Preserve the user's favorite order (as stored), falling back to STYLES order
      filtered.sort((a, b) => keys.indexOf(a.key) - keys.indexOf(b.key));
      return filtered.length ? filtered : STYLES;
    } catch (_) {
      return STYLES.filter(s => DEFAULT_FAVS.includes(s.key));
    }
  }

  /* Decide whether the highlighted text can be replaced in place, and
     if so, capture the target reference. Called at the start of showPanel
     before the panel DOM steals focus. */
  function captureTarget() {
    const active = document.activeElement;

    // Case 1: input or textarea
    if (
      active &&
      (active.tagName === 'TEXTAREA' ||
       (active.tagName === 'INPUT' && /^(text|search|email|tel|url|password|number)$/i.test(active.type || 'text')))
    ) {
      const readOnly = active.readOnly || active.disabled;
      const start = active.selectionStart;
      const end   = active.selectionEnd;
      if (!readOnly && start != null && end != null && start !== end) {
        return { kind: 'input', el: active, start, end };
      }
      return { kind: 'readonly', reason: readOnly ? 'This field is read-only.' : 'Selection lost — try again.' };
    }

    // Case 2: contenteditable
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      const range = sel.getRangeAt(0);
      let node = range.commonAncestorContainer;
      // Walk up looking for an editable host
      while (node && node !== document) {
        const el = node.nodeType === 1 ? node : node.parentElement;
        if (el && el.isContentEditable) {
          return { kind: 'contenteditable', el, range: range.cloneRange() };
        }
        node = (node.parentNode || null);
      }
      // Selection exists but isn't editable — read-only text node / article body
      return { kind: 'readonly', reason: "Can't replace text here — this page isn't editable. Use Copy instead." };
    }

    return { kind: 'readonly', reason: "Can't replace text here. Use Copy instead." };
  }

  /* ── Replace logic ───────────────────────────────── */

  /* Programmatically setting .value on an input doesn't notify React's
     value tracker, so type-into-React fields wouldn't see the change.
     Using the native HTMLInputElement/HTMLTextAreaElement value setter
     bypasses React's hooked setter and the subsequent 'input' event
     triggers React's onChange normally. Works for Vue / Svelte / vanilla
     too because they all listen for the input event. */
  function setNativeValue(el, value) {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    if (setter) setter.call(el, value);
    else el.value = value;
  }

  function replaceInInput(t, newText) {
    const { el, start, end } = t;
    if (!el.isConnected) return false;
    el.focus();
    const v = el.value;
    const next = v.slice(0, start) + newText + v.slice(end);
    setNativeValue(el, next);
    try {
      el.setSelectionRange(start + newText.length, start + newText.length);
    } catch (_) { /* some input types don't allow setSelectionRange */ }
    el.dispatchEvent(new Event('input',  { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  function replaceInContentEditable(t, newText) {
    const { el, range } = t;
    if (!el.isConnected) return false;
    el.focus();
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    // execCommand('insertText', ...) is the only DOM API that fires the
    // 'beforeinput' / 'input' events frameworks listen for on
    // contenteditable. Deprecated in spec, but every browser still
    // implements it and rich-text editors (Notion, Gmail, Twitter,
    // Discord, Slack) rely on it.
    let ok = false;
    try {
      ok = document.execCommand('insertText', false, newText);
    } catch (_) { ok = false; }

    if (!ok) {
      // Fallback: manual Range manipulation. Frameworks may not pick
      // this up but it at least gets the text in.
      try {
        range.deleteContents();
        range.insertNode(document.createTextNode(newText));
        el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: newText }));
        ok = true;
      } catch (_) { ok = false; }
    }
    return ok;
  }

  function replaceSelection(newText) {
    if (!target) return false;
    if (target.kind === 'input')           return replaceInInput(target, newText);
    if (target.kind === 'contenteditable') return replaceInContentEditable(target, newText);
    return false;
  }

  /* ── Show the panel ──────────────────────────────── */
  async function showPanel(text) {
    panelText = text;
    if (panelHost) dismiss();   // reset if one is already open

    // Capture replacement target BEFORE we build the panel — once the
    // panel is in the DOM, clicking it will move focus into the shadow
    // root and we'll lose the activeElement/Range we need.
    target = captureTarget();

    const styles = await getFavoriteStyles();

    panelHost = document.createElement('div');
    panelHost.id = HOST_ID;
    // Reset every inherited property so host page CSS can't pierce us.
    panelHost.style.cssText = 'all: initial; position: fixed; z-index: 2147483647; top: 0; left: 0;';
    panelRoot = panelHost.attachShadow({ mode: 'closed' });

    // Inject the panel's stylesheet
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('panel.css');
    panelRoot.appendChild(link);

    // Build panel DOM
    const panel = document.createElement('div');
    panel.className = 'tf-panel';

    panel.appendChild(buildHeader());
    panel.appendChild(buildSourcePreview(text));
    panel.appendChild(buildList(text, styles));

    panelRoot.appendChild(panel);
    document.body.appendChild(panelHost);

    // Position once the panel has been laid out
    requestAnimationFrame(() => positionPanel(panel));

    // Dismissal listeners
    escListener = e => { if (e.key === 'Escape') { e.stopPropagation(); dismiss(); } };
    outsideListener = e => {
      if (!panelHost) return;
      if (e.target === panelHost) return;
      // Click inside the shadow host bubbles up with target = panelHost
      // (because shadow root is closed). If target isn't panelHost, the
      // click was outside.
      dismiss();
    };
    document.addEventListener('keydown', escListener, true);
    // Defer to next tick so the contextmenu's own mouseup doesn't dismiss us
    setTimeout(() => document.addEventListener('mousedown', outsideListener, true), 0);
  }

  function dismiss() {
    if (escListener)     document.removeEventListener('keydown',  escListener,     true);
    if (outsideListener) document.removeEventListener('mousedown', outsideListener, true);
    escListener = null;
    outsideListener = null;
    if (panelHost && panelHost.parentNode) panelHost.parentNode.removeChild(panelHost);
    panelHost = null;
    panelRoot = null;
    panelText = '';
    target = null;
  }

  /* Post-copy aha-nudge: one-per-session Ko-fi tip inserted beneath the
     row the user just copied, inside the shadow root. Shares the 'ahaShown'
     flag with the popup via chrome.storage.session (background.js grants
     untrusted-context access via setAccessLevel; without it storage.session
     is trusted-only and the get below throws — caught so the nudge is simply
     skipped). Built with DOM APIs, not innerHTML, so it survives host pages
     that enforce Trusted Types (same discipline as the rest of this file).
     Only wired to Copy, not Replace: Replace dismisses the panel ~350ms
     later, so a nudge there would flash invisibly and waste the flag. */
  async function maybeShowAhaNudge(anchorRow) {
    if (!anchorRow) return;
    try {
      const { ahaShown } = await chrome.storage.session.get('ahaShown');
      if (ahaShown) return;
      await chrome.storage.session.set({ ahaShown: true });
    } catch (_) { return; }

    const nudge = document.createElement('div');
    nudge.className = 'aha-nudge show';

    const msg = document.createElement('span');
    msg.className = 'aha-msg';
    msg.textContent = 'Found this useful?';

    const tip = document.createElement('a');
    tip.className = 'aha-tip';
    tip.href = 'https://ko-fi.com/abaker421';
    tip.target = '_blank';
    tip.rel = 'noopener noreferrer';
    tip.textContent = '☕ Tip';
    tip.addEventListener('click', () => setTimeout(() => nudge.remove(), 100));

    const x = document.createElement('button');
    x.className = 'aha-x';
    x.type = 'button';
    x.setAttribute('aria-label', 'Dismiss');
    x.textContent = '×';
    x.addEventListener('click', e => { e.stopPropagation(); nudge.remove(); });

    nudge.appendChild(msg);
    nudge.appendChild(tip);
    nudge.appendChild(x);
    anchorRow.insertAdjacentElement('afterend', nudge);
  }

  /* ── Panel pieces ────────────────────────────────── */
  function buildHeader() {
    const h = document.createElement('div');
    h.className = 'tf-header';

    const left = document.createElement('div');
    left.className = 'tf-title';
    const badge = document.createElement('span');
    badge.className = 'tf-badge';
    badge.innerHTML = '<svg viewBox="0 0 192 192" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="tfPanelBadgeBg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#3a64a3"/><stop offset="100%" stop-color="#2B4A8B"/></linearGradient></defs><rect width="192" height="192" rx="42" ry="42" fill="url(#tfPanelBadgeBg)"/><path fill-rule="evenodd" fill="#FFFFFF" stroke="#0F1626" stroke-width="2" stroke-linejoin="round" d="M 38,38 L 64,38 L 64,114 A 14 14 0 0 0 78 128 L 114,128 A 14 14 0 0 0 128 114 L 128,38 L 154,38 L 154,118 A 36 36 0 0 1 118 154 L 74,154 A 36 36 0 0 1 38 118 Z"/></svg>';
    const name = document.createElement('span');
    name.className = 'tf-title-text';
    name.textContent = 'UniStyle';
    left.appendChild(badge);
    left.appendChild(name);

    // Small badge indicating whether Replace is available
    const modeBadge = document.createElement('span');
    modeBadge.className = 'tf-mode' + (target && target.kind !== 'readonly' ? ' tf-mode-editable' : '');
    modeBadge.textContent = (target && target.kind !== 'readonly') ? 'Editable' : 'Read-only';
    modeBadge.title = (target && target.kind !== 'readonly')
      ? 'You can use Replace on this page.'
      : (target && target.reason) || "Can't replace text here. Use Copy instead.";
    left.appendChild(modeBadge);

    const close = document.createElement('button');
    close.className = 'tf-close';
    close.type = 'button';
    close.setAttribute('aria-label', 'Close');
    close.textContent = '✕';
    close.addEventListener('click', e => { e.stopPropagation(); dismiss(); });

    h.appendChild(left);
    h.appendChild(close);
    return h;
  }

  function buildSourcePreview(text) {
    const wrap = document.createElement('div');
    wrap.className = 'tf-source';
    const label = document.createElement('span');
    label.className = 'tf-source-label';
    label.textContent = 'Selected:';
    const val = document.createElement('span');
    val.className = 'tf-source-text';
    val.textContent = text.length > 80 ? text.slice(0, 80) + '…' : text;
    val.title = text;
    wrap.appendChild(label);
    wrap.appendChild(val);
    return wrap;
  }

  function buildList(text, styles) {
    const list = document.createElement('div');
    list.className = 'tf-list';

    if (typeof STYLES === 'undefined') {
      const err = document.createElement('div');
      err.className = 'tf-error';
      err.textContent = 'Engine not loaded — try reloading the extension.';
      list.appendChild(err);
      return list;
    }

    const isEditable = !!(target && target.kind !== 'readonly');
    const readOnlyReason = target && target.reason;

    /* F16 (v1.6.0): Cleanup section at the top of the panel.
       Currently one entry: Format Sentences. Distinct from the
       Unicode-style rows below so users understand it's a
       different kind of action (text cleanup, not letter restyling). */
    list.appendChild(buildCleanupSection(text, isEditable, readOnlyReason));

    if (!styles || styles.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'tf-error';
      empty.textContent = 'No favorite styles selected. Open the toolbar popup and star the styles you want here.';
      list.appendChild(empty);
      return list;
    }

    // Section header for the style rows
    const stylesHeader = document.createElement('div');
    stylesHeader.className = 'tf-section-header';
    stylesHeader.textContent = 'Unicode Styles';
    list.appendChild(stylesHeader);

    for (const style of styles) {
      const row = document.createElement('div');
      row.className = 'tf-row';

      const meta = document.createElement('div');
      meta.className = 'tf-meta';

      const lbl = document.createElement('div');
      lbl.className = 'tf-label';
      lbl.textContent = style.label;

      const prev = document.createElement('div');
      prev.className = 'tf-preview';
      const rendered = style.hasSlider ? style.fn(text, 1) : style.fn(text);
      prev.textContent = rendered;
      prev.title = rendered;

      meta.appendChild(lbl);
      meta.appendChild(prev);

      // ── Replace button ──
      const replaceBtn = document.createElement('button');
      replaceBtn.className = 'tf-replace';
      replaceBtn.type = 'button';
      replaceBtn.textContent = 'Replace';
      if (!isEditable) {
        replaceBtn.disabled = true;
        replaceBtn.title = readOnlyReason || "Can't replace text here.";
      } else {
        replaceBtn.title = 'Replace the selected text on the page with this style';
      }
      replaceBtn.addEventListener('click', e => {
        e.stopPropagation();
        if (!isEditable) return;
        const ok = replaceSelection(rendered);
        if (ok) {
          setLastUsedStyle(style.key); // F15: remember this style for the hotkey
          replaceBtn.textContent = 'Done';
          replaceBtn.classList.add('done');
          // Brief flash, then dismiss the panel — user got their result
          setTimeout(dismiss, 350);
        } else {
          replaceBtn.textContent = 'Failed';
          setTimeout(() => {
            if (replaceBtn.isConnected) replaceBtn.textContent = 'Replace';
          }, 1100);
        }
      });

      // ── Copy button ──
      const copyBtn = document.createElement('button');
      copyBtn.className = 'tf-copy';
      copyBtn.type = 'button';
      copyBtn.textContent = 'Copy';
      copyBtn.title = 'Copy this style to the clipboard';
      copyBtn.addEventListener('click', async e => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(rendered);
          setLastUsedStyle(style.key); // F15: remember this style for the hotkey
          copyBtn.textContent = 'Copied';
          copyBtn.classList.add('copied');
          maybeShowAhaNudge(row);
          setTimeout(() => {
            if (copyBtn.isConnected) {
              copyBtn.textContent = 'Copy';
              copyBtn.classList.remove('copied');
            }
          }, 1100);
        } catch (_) {
          copyBtn.textContent = 'Failed';
          setTimeout(() => { if (copyBtn.isConnected) copyBtn.textContent = 'Copy'; }, 1100);
        }
      });

      row.appendChild(meta);
      row.appendChild(copyBtn);
      row.appendChild(replaceBtn);
      list.appendChild(row);
    }
    return list;
  }

  /* F16 (v1.6.0): Build the Cleanup section that lives at the top
     of the inline panel. Currently one entry (Format Sentences),
     structured to support future cleanup actions without re-design. */
  function buildCleanupSection(text, isEditable, readOnlyReason) {
    const section = document.createElement('div');
    section.className = 'tf-cleanup-section';

    const header = document.createElement('div');
    header.className = 'tf-section-header';
    header.textContent = 'Cleanup';
    section.appendChild(header);

    // Format Sentences row (renders as a regular tf-row for visual parity)
    const row = document.createElement('div');
    row.className = 'tf-row';

    const meta = document.createElement('div');
    meta.className = 'tf-meta';
    const lbl = document.createElement('div');
    lbl.className = 'tf-label';
    lbl.textContent = 'Format Sentences';
    const prev = document.createElement('div');
    prev.className = 'tf-preview';
    const rendered = formatSentences(text);
    prev.textContent = rendered;
    prev.title = rendered;
    meta.appendChild(lbl);
    meta.appendChild(prev);

    const replaceBtn = document.createElement('button');
    replaceBtn.className = 'tf-replace';
    replaceBtn.type = 'button';
    replaceBtn.textContent = 'Replace';
    if (!isEditable) {
      replaceBtn.disabled = true;
      replaceBtn.title = readOnlyReason || "Can't replace text here.";
    } else {
      replaceBtn.title = 'Replace the selected text on the page with the cleaned-up version';
    }
    replaceBtn.addEventListener('click', e => {
      e.stopPropagation();
      if (!isEditable) return;
      const ok = replaceSelection(rendered);
      if (ok) {
        setLastUsedStyle('format-sentences'); // F15 hotkey will reapply this
        replaceBtn.textContent = 'Done';
        replaceBtn.classList.add('done');
        setTimeout(dismiss, 350);
      } else {
        replaceBtn.textContent = 'Failed';
        setTimeout(() => {
          if (replaceBtn.isConnected) replaceBtn.textContent = 'Replace';
        }, 1100);
      }
    });

    const copyBtn = document.createElement('button');
    copyBtn.className = 'tf-copy';
    copyBtn.type = 'button';
    copyBtn.textContent = 'Copy';
    copyBtn.title = 'Copy the cleaned-up text to the clipboard';
    copyBtn.addEventListener('click', async e => {
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(rendered);
        setLastUsedStyle('format-sentences');
        copyBtn.textContent = 'Copied';
        copyBtn.classList.add('copied');
        maybeShowAhaNudge(row);
        setTimeout(() => {
          if (copyBtn.isConnected) {
            copyBtn.textContent = 'Copy';
            copyBtn.classList.remove('copied');
          }
        }, 1100);
      } catch (_) {
        copyBtn.textContent = 'Failed';
        setTimeout(() => { if (copyBtn.isConnected) copyBtn.textContent = 'Copy'; }, 1100);
      }
    });

    row.appendChild(meta);
    row.appendChild(copyBtn);
    row.appendChild(replaceBtn);
    section.appendChild(row);
    return section;
  }

  /* ── Positioning ─────────────────────────────────── */
  function positionPanel(panel) {
    const rect = getSelectionRect();
    const pw = panel.offsetWidth  || 360;
    const ph = panel.offsetHeight || 480;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const PAD = 8;

    let top, left;
    if (rect) {
      // Prefer below the selection; flip above if not enough room
      if (vh - rect.bottom >= ph + PAD) {
        top = rect.bottom + PAD;
      } else if (rect.top >= ph + PAD) {
        top = rect.top - ph - PAD;
      } else {
        top = Math.max(PAD, vh - ph - PAD);
      }
      left = rect.left;
    } else {
      // Center fallback
      top  = Math.max(PAD, (vh - ph) / 2);
      left = Math.max(PAD, (vw - pw) / 2);
    }

    // Clamp horizontally
    left = Math.max(PAD, Math.min(left, vw - pw - PAD));
    // Clamp vertically
    top  = Math.max(PAD, Math.min(top,  vh - ph - PAD));

    panelHost.style.top  = `${top}px`;
    panelHost.style.left = `${left}px`;
  }

  function getSelectionRect() {
    // For input/textarea, fall back to the element's own bounding rect
    if (target && target.kind === 'input' && target.el.isConnected) {
      const r = target.el.getBoundingClientRect();
      if (r && (r.width || r.height)) return r;
    }
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
    const range = sel.getRangeAt(0);
    const r = range.getBoundingClientRect();
    if (r && (r.width || r.height)) return r;
    return null;
  }

  /* ── F15: Inline-hotkey transform helpers (v1.6.0) ─────
   * Triggered by the chrome.commands "transform-inline" shortcut. The
   * service worker delivers the event via the tf-transform-inline
   * message; this function reads the selection, looks up the user's
   * last-used style, applies the transform, and either replaces in
   * place or falls back to clipboard with a toast.
   */

  /* Read/write last-used style. chrome.storage.local is preferred over
     sync here because (a) hotkey latency matters and local is faster,
     (b) the value is per-device-meaningful, not strictly a preference
     worth syncing. Errors are swallowed - falling back to 'bold' is
     never a bad outcome. */
  async function getLastUsedStyle() {
    try {
      const data = await chrome.storage.local.get(LAST_USED_KEY);
      const v = data && data[LAST_USED_KEY];
      return (typeof v === 'string' && v) ? v : 'bold';
    } catch (_) { return 'bold'; }
  }
  function setLastUsedStyle(key) {
    if (!key || typeof key !== 'string') return;
    try { chrome.storage.local.set({ [LAST_USED_KEY]: key }); } catch (_) {}
  }

  /* Apply a transform by key. Handles the format-sentences pseudo-key
     and falls back to bold if the key is unknown (e.g. user deleted
     and reinstalled the extension with a missing style). */
  function transformByKey(key, text) {
    if (key === 'format-sentences') return formatSentences(text);
    const style = STYLES_MAP[key];
    if (!style) {
      const fallback = STYLES_MAP['bold'];
      return fallback ? fallback.fn(text) : text;
    }
    return style.hasSlider ? style.fn(text, 1) : style.fn(text);
  }

  /* Human-readable label for a style key (used in toast messages). */
  function labelForKey(key) {
    if (key === 'format-sentences') return 'Format Sentences';
    const s = STYLES_MAP[key];
    return s ? s.label : key;
  }

  /* Toast: brief, top-right, auto-dismiss after 2.2s. Lives in its own
     shadow root so host page CSS can't pierce. Open mode so DevTools
     inspectors can still pierce for debugging if needed.
     Defensive: explicit display:block on host (`all: initial` resets div
     display to inline, which can shrink-wrap to zero-width), and falls
     back to document.documentElement if document.body isn't available
     (rare: very early page lifecycle). */
  function showToast(message) {
    try {
      const prev = document.getElementById(TOAST_HOST_ID);
      if (prev && prev.parentNode) prev.parentNode.removeChild(prev);

      const parent = document.body || document.documentElement;
      if (!parent) return;

      const host = document.createElement('div');
      host.id = TOAST_HOST_ID;
      host.style.cssText =
        'all: initial; position: fixed; z-index: 2147483647; top: 16px; right: 16px;' +
        'display: block; pointer-events: none;';
      const root = host.attachShadow({ mode: 'open' });

      const style = document.createElement('style');
      style.textContent =
        '.tf-toast {' +
          'display: block;' +
          'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;' +
          'font-size: 13px;' +
          'line-height: 1.4;' +
          'font-weight: 600;' +
          'color: #ffffff;' +
          'background: rgba(28, 53, 96, 0.96);' +
          'padding: 10px 14px;' +
          'border-radius: 8px;' +
          'border-left: 3px solid #E0A82E;' + // UniStyle per-product accent (amber) - see BRAND.md
          'box-shadow: 0 4px 14px rgba(0,0,0,0.22), 0 1px 3px rgba(0,0,0,0.18);' +
          'max-width: 320px;' +
          'animation: tfin 0.18s ease-out;' +
        '}' +
        '@keyframes tfin { from { transform: translateY(-8px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }';
      root.appendChild(style);

      const div = document.createElement('div');
      div.className = 'tf-toast';
      div.textContent = message;
      root.appendChild(div);

      parent.appendChild(host);
      setTimeout(() => { if (host.parentNode) host.parentNode.removeChild(host); }, 2200);
    } catch (err) {
      // Last-ditch fallback if shadow DOM somehow fails - never let toast
      // failure swallow the user's signal that something happened.
      console.warn('[UniStyle] toast failed:', err && err.message, 'message was:', message);
    }
  }

  /* F15 entry point: handle the hotkey-driven transform. */
  async function transformInline() {
    // Capture the selection before any async hops so focus doesn't move
    const t = captureTarget();

    // Pull the actual text out of the captured target (or the raw selection
    // for the read-only fallback path so clipboard still gets something)
    let text = '';
    if (t.kind === 'input') {
      text = (t.el.value || '').slice(t.start, t.end);
    } else if (t.kind === 'contenteditable') {
      text = t.range ? t.range.toString() : '';
    } else {
      const sel = window.getSelection();
      text = sel ? sel.toString() : '';
    }
    text = (text || '').trim();
    if (!text) {
      // Defensive double-attempt: showToast on the next tick if document.body
      // happened to be in a transient state (rare). Both paths idempotent
      // via prev-host removal.
      showToast('Select text first, then press the hotkey.');
      setTimeout(() => showToast('Select text first, then press the hotkey.'), 30);
      return;
    }

    const styleKey = await getLastUsedStyle();
    const transformed = transformByKey(styleKey, text);
    const styleLabel = labelForKey(styleKey);

    // Try in-place replacement first
    if (t.kind !== 'readonly') {
      target = t; // module-level target used by replaceSelection
      const ok = replaceSelection(transformed);
      target = null;
      if (ok) {
        showToast('Transformed: ' + styleLabel);
        return;
      }
    }

    // Fallback: copy to clipboard so user can paste manually
    try {
      await navigator.clipboard.writeText(transformed);
      showToast('Copied formatted text (' + styleLabel + ') - not editable here.');
    } catch (_) {
      showToast("Couldn't transform here. Try the toolbar popup.");
    }
  }

  /* F17 (v1.6.0): hotkey-driven panel open. Reads the current selection
     text from the page and opens the inline panel just like the right-
     click context menu does. If nothing is selected, shows a toast
     instead of an empty panel. */
  function openPanelFromHotkey() {
    // Pull text from whichever surface has the selection (input/textarea
    // vs contenteditable vs raw selection). Same priority order as
    // transformInline's text-extraction logic.
    let text = '';
    const active = document.activeElement;
    if (active && (active.tagName === 'TEXTAREA' ||
        (active.tagName === 'INPUT' && /^(text|search|email|tel|url|password|number)$/i.test(active.type || 'text')))) {
      const s = active.selectionStart;
      const e = active.selectionEnd;
      if (s != null && e != null && s !== e) {
        text = (active.value || '').slice(s, e);
      }
    }
    if (!text) {
      const sel = window.getSelection();
      text = sel ? sel.toString() : '';
    }
    text = (text || '').trim();
    if (!text) {
      showToast('Select text first, then press the hotkey.');
      return;
    }
    showPanel(text);
  }

  /* ── Message listener ────────────────────────────── */
  chrome.runtime.onMessage.addListener((msg, _sender, _sendResponse) => {
    if (msg && msg.type === 'tf-show-panel' && typeof msg.text === 'string') {
      showPanel(msg.text);
    } else if (msg && msg.type === 'tf-transform-inline') {
      transformInline();
    } else if (msg && msg.type === 'tf-open-panel-from-hotkey') {
      openPanelFromHotkey();
    }
  });
})();
