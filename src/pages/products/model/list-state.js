import { createStore } from '../../../shared/lib/store.js';
import { stateFromSearch, buildQueryString } from '../../../entities/product/index.js';

/**
 * @typedef {import('../../../entities/product/query.js').ListState} ListState
 */

/**
 * The list state lives in the URL. This module owns:
 *  - reading + sanitizing the initial state from the current location,
 *  - writing changes back with the History API (pushState for user actions,
 *    replaceState for sanitizing / out-of-range corrections),
 *  - listening for back/forward (popstate).
 *
 * `createListState()` returns a store plus a few semantic mutators.
 *
 * @param {Object} [options]
 * @param {Window} [options.windowRef]
 */
export function createListState({ windowRef = window } = {}) {
  const store = createStore(readFromUrl());

  /** @returns {ListState} */
  function readFromUrl() {
    return stateFromSearch(windowRef.location.search);
  }

  /**
   * Write the state to the URL. `replace=true` updates the current history
   * entry (used for sanitizing an invalid URL) instead of pushing a new one.
   * @param {ListState} state
   * @param {boolean} [replace]
   */
  function writeToUrl(state, replace = false) {
    const qs = buildQueryString(state);
    const url = `${windowRef.location.pathname}${qs ? `?${qs}` : ''}`;
    const method = replace ? 'replaceState' : 'pushState';
    windowRef.history[method](state, '', url);
  }

  /**
   * Apply a partial state update. By default the page resets to 1 (filter /
   * sort changes must restart at the first page). Pass `resetPage: false` for
   * pure pagination.
   *
   * @param {Partial<ListState>} patch
   * @param {{ resetPage?: boolean, replace?: boolean }} [options]
   */
  function update(patch, { resetPage = true, replace = false } = {}) {
    const current = store.get();
    /** @type {ListState} */
    const next = { ...current, ...patch };
    if (resetPage && patch.page === undefined) {
      next.page = 1;
    }
    next.page = Math.max(1, next.page);
    store.set(next);
    writeToUrl(next, replace);
  }

  /** @param {number} page */
  function goToPage(page) {
    update({ page }, { resetPage: false });
  }

  /**
   * Correct an out-of-range page in place (no new history entry).
   * Called after the API reports the real totalPages.
   *
   * @param {number} requestedPage
   * @param {number} totalPages
   * @returns {boolean} true when a correction was applied
   */
  function reconcilePage(requestedPage, totalPages) {
    if (totalPages > 0 && requestedPage > totalPages) {
      const corrected = { ...store.get(), page: totalPages };
      store.set(corrected);
      writeToUrl(corrected, true);
      return true;
    }
    return false;
  }

  /**
   * On load, drop invalid values from the URL by rewriting it (replaceState)
   * if the sanitized state differs from the raw query.
   */
  function sanitizeUrlOnLoad() {
    const original = new URLSearchParams(windowRef.location.search);
    const sanitized = stateFromSearch(windowRef.location.search);
    const rebuilt = new URLSearchParams(buildQueryString(sanitized));

    const differs =
      original.toString() !== rebuilt.toString() ||
      [...original.keys()].some((key) => !rebuilt.has(key));

    if (differs) {
      writeToUrl(sanitized, true);
    }
  }

  /** Re-read the URL into the store (used on popstate). */
  function syncFromUrl() {
    store.set(readFromUrl());
  }

  return {
    store,
    update,
    goToPage,
    reconcilePage,
    sanitizeUrlOnLoad,
    syncFromUrl,
  };
}
