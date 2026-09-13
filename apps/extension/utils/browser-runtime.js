/**
 * Cross-browser WebExtension API access.
 *
 * Chrome only defines `chrome.*`. Firefox defines both: `browser.*` is
 * native and promise-based; `chrome.*` is a compatibility alias that stays
 * callback-based there, so `await chrome.tabs.query(...)` silently returns
 * `undefined` on Firefox instead of the tab list. Preferring `browser` when
 * it exists gets promise-based behavior from every call site on both
 * browsers without a polyfill.
 */
export const browserApi = globalThis.browser ?? globalThis.chrome;

/** Firefox exposes `browser` natively; Chrome and Chromium forks do not. */
export const isFirefox = typeof globalThis.browser !== "undefined";

/**
 * Chrome's Side Panel and Firefox's Sidebar are different features with
 * different manifest keys (`side_panel` vs `sidebar_action`) and different
 * `open()` contracts:
 *
 * - Chrome's `sidePanel.open()` needs a `windowId` or `tabId`.
 * - Firefox's `sidebarAction.open()` takes no arguments, but MUST be called
 *   with no `await` before it anywhere in the click handler's call stack —
 *   Firefox revokes "user input handler" status the instant a promise is
 *   awaited, and rejects the call otherwise.
 *
 * Call this before awaiting anything else in the click handler.
 */
export function openReviewPanel(windowId) {
  if (isFirefox) {
    return browserApi.sidebarAction.open();
  }
  if (browserApi.sidePanel?.open && windowId != null) {
    return browserApi.sidePanel.open({ windowId });
  }
  return Promise.reject(
    new Error("This browser does not support a docked review panel."),
  );
}
