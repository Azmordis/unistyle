/* UniStyle - Background service worker (MV3)
 *
 * Responsibilities:
 *   1. Register the "Format with UniStyle" context-menu item
 *      that appears when the user right-clicks selected text.
 *   2. When the user clicks the menu item, deliver the selected text
 *      to the active tab's content script, which renders the panel.
 *   3. Handle the "transform-inline" keyboard command (v1.6.0 - F15):
 *      transforms the active page's current selection in place using
 *      the user's last-used style, with a clipboard-fallback toast
 *      when the selection isn't in an editable element.
 *
 * Why on-demand injection?
 *   As of v1.5.0 the manifest no longer declares a static content_scripts
 *   entry against <all_urls> (that triggered the install warning "Read
 *   and change all your data on all websites"). Instead, the extension
 *   relies on the activeTab + scripting permissions to inject engine.js +
 *   content.js into the active tab on the FIRST right-click, then reuses
 *   the already-injected listener on subsequent right-clicks in that tab.
 *
 *   ensureContentScript probes for window.__tfContentLoaded; if absent,
 *   it injects via chrome.scripting.executeScript. The script's IIFE
 *   sets that flag and bails on re-entry, so reinjection is a safe no-op.
 *
 *   Restricted URLs (chrome://, the Chrome Web Store, PDF viewer) cannot
 *   be injected into; executeScript throws and the catch below swallows
 *   the error - the menu item simply does nothing on those pages.
 */

const MENU_ID = 'tf-format-selection';

/* Let the content-script panel (an untrusted context) read/write
   chrome.storage.session so the once-per-session post-copy nudge flag
   ('ahaShown') is shared between the popup and the right-click panel.
   storage.session is trusted-contexts-only by default, so without this the
   panel's read throws. Called at top level so it re-applies on every service
   worker startup. Guarded for older Chrome that lacks setAccessLevel — there
   the panel nudge just won't show. */
try {
  chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' });
} catch (_) { /* setAccessLevel unavailable — panel nudge gracefully disabled */ }

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: 'Format with UniStyle',
    contexts: ['selection']
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID) return;
  if (!tab || tab.id == null) return;

  const text = (info.selectionText || '').toString();
  if (!text) return;

  try {
    await ensureContentScript(tab.id);
    await chrome.tabs.sendMessage(tab.id, { type: 'tf-show-panel', text });
  } catch (err) {
    // Most likely a restricted URL (chrome://, web store, PDF viewer).
    // Nothing actionable for the user; keep the SW console quiet.
    console.debug('[TextFormatter] could not show panel:', err && err.message);
  }
});

/* ── F15 inline-hotkey transform (v1.6.0) ────────────────
 * Fires when the user presses the configured shortcut for the
 * "transform-inline" command (default Ctrl+Shift+U / Cmd+Shift+U).
 * The service worker can't read the page selection directly, so we
 * just route the command into the content script. content.js then
 * reads the last-used style from chrome.storage.local, grabs the
 * active selection, transforms it, and either replaces in place
 * (editable target) or falls back to clipboard with a toast.
 *
 * Restricted URLs: scripting.executeScript throws and we swallow
 * the error - matches the context-menu handler's behavior. No new
 * UX needed on those surfaces.
 */
chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || tab.id == null) return;

  if (command === 'transform-inline') {
    try {
      await ensureContentScript(tab.id);
      await chrome.tabs.sendMessage(tab.id, { type: 'tf-transform-inline' });
    } catch (err) {
      console.debug('[UniStyle] inline transform unavailable here:', err && err.message);
    }
    return;
  }

  /* F17 (v1.6.0): "open-panel-inline" hotkey - opens the UniStyle
     panel for the currently selected text (same UI as the right-click
     "Format with UniStyle" menu, but reachable via keyboard).
     content.js reads the page selection itself - background.js can't
     access it. If nothing is selected, content.js shows a toast instead
     of an empty panel. */
  if (command === 'open-panel-inline') {
    try {
      await ensureContentScript(tab.id);
      await chrome.tabs.sendMessage(tab.id, { type: 'tf-open-panel-from-hotkey' });
    } catch (err) {
      console.debug('[UniStyle] open-panel hotkey unavailable here:', err && err.message);
    }
    return;
  }
});

/* Make sure engine.js + content.js are loaded in the tab's isolated
   world. If they're already there, skip — engine.js can't be re-evaluated
   safely because its top-level `const` declarations would collide.

   Returns a promise. Throws on restricted URLs (which is fine — the
   caller swallows it). */
async function ensureContentScript(tabId) {
  // Probe: is the content script already registered?
  const [probe] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => window.__tfContentLoaded === true
  });
  if (probe && probe.result === true) return;

  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['engine.js', 'content.js']
  });
}
