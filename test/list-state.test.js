import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createListState } from '../src/pages/products/model/list-state.js';

/**
 * Build a minimal fake window with a working history + location so URL sync
 * can be tested without a real navigation.
 *
 * @param {string} [initialSearch]
 */
function fakeWindow(initialSearch = '') {
  let search = initialSearch;
  const pushState = vi.fn((_state, _title, url) => {
    search = String(url).includes('?') ? `?${String(url).split('?')[1]}` : '';
  });
  const replaceState = vi.fn((_state, _title, url) => {
    search = String(url).includes('?') ? `?${String(url).split('?')[1]}` : '';
  });

  const windowRef = {
    location: {
      pathname: '/',
      get search() {
        return search;
      },
    },
    history: { pushState, replaceState },
  };

  return { windowRef, pushState, replaceState };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('list-state – initial state', () => {
  it('reads and sanitizes the initial URL', () => {
    const { windowRef } = fakeWindow('?page=2&sort=price&order=desc&brandId=1&search=audi');
    const { store } = createListState({ windowRef: /** @type {any} */ (windowRef) });

    expect(store.get()).toMatchObject({
      page: 2,
      sort: 'price',
      order: 'desc',
      brandId: 1,
      search: 'audi',
    });
  });

  it('never trusts invalid URL values', () => {
    const { windowRef } = fakeWindow('?page=abc&sort=hack&order=up&brandId=-1&priceTo=%20');
    const { store } = createListState({ windowRef: /** @type {any} */ (windowRef) });

    expect(store.get()).toMatchObject({
      page: 1,
      sort: 'code',
      order: 'asc',
      brandId: null,
      priceTo: null,
    });
  });
});

describe('list-state – url sync', () => {
  it('pushes state changes to the URL', () => {
    const { windowRef, pushState } = fakeWindow('');
    const { update } = createListState({ windowRef: /** @type {any} */ (windowRef) });

    update({ sort: 'name', order: 'desc' });

    expect(pushState).toHaveBeenCalled();
    expect(windowRef.location.search).toContain('sort=name');
    expect(windowRef.location.search).toContain('order=desc');
  });

  it('re-reads the URL on syncFromUrl (popstate)', () => {
    const { windowRef } = fakeWindow('?page=3&search=x');
    const { store, syncFromUrl } = createListState({ windowRef: /** @type {any} */ (windowRef) });

    expect(store.get().page).toBe(3);
    const live = /** @type {any} */ (windowRef);
    live.history.pushState(live, '', '/?page=5&search=y');
    syncFromUrl();

    expect(store.get()).toMatchObject({ page: 5, search: 'y' });
  });
});

describe('list-state – filter change resets page', () => {
  it('resets page to 1 when a filter changes', () => {
    const { windowRef } = fakeWindow('?page=4');
    const { store, update } = createListState({ windowRef: /** @type {any} */ (windowRef) });

    expect(store.get().page).toBe(4);
    update({ brandId: 2 });

    expect(store.get().page).toBe(1);
    expect(store.get().brandId).toBe(2);
  });

  it('resets page when search changes', () => {
    const { windowRef } = fakeWindow('?page=3');
    const { store, update } = createListState({ windowRef: /** @type {any} */ (windowRef) });

    update({ search: 'kryt' });
    expect(store.get().page).toBe(1);
  });

  it('resets page when sort changes', () => {
    const { windowRef } = fakeWindow('?page=2');
    const { store, update } = createListState({ windowRef: /** @type {any} */ (windowRef) });

    update({ sort: 'price', order: 'desc' });
    expect(store.get().page).toBe(1);
  });

  it('does NOT reset page when only the page changes', () => {
    const { windowRef } = fakeWindow('?sort=name');
    const { store, goToPage } = createListState({ windowRef: /** @type {any} */ (windowRef) });

    goToPage(3);
    expect(store.get().page).toBe(3);
    expect(store.get().sort).toBe('name');
  });
});

describe('list-state – out-of-range page reconciliation', () => {
  it('moves to the last page with replaceState when page > totalPages', () => {
    const { windowRef, replaceState, pushState } = fakeWindow('?page=99&sort=price');
    const { store, reconcilePage } = createListState({ windowRef: /** @type {any} */ (windowRef) });

    const corrected = reconcilePage(99, 3);

    expect(corrected).toBe(true);
    expect(store.get().page).toBe(3);
    expect(replaceState).toHaveBeenCalled();
    expect(pushState).not.toHaveBeenCalled();
  });

  it('does nothing when totalPages is 0 (empty result is handled by the caller)', () => {
    const { windowRef, replaceState } = fakeWindow('?page=5');
    const { store, reconcilePage } = createListState({ windowRef: /** @type {any} */ (windowRef) });

    const corrected = reconcilePage(5, 0);

    expect(corrected).toBe(false);
    expect(store.get().page).toBe(5);
    expect(replaceState).not.toHaveBeenCalled();
  });

  it('does nothing when the page is within range', () => {
    const { windowRef } = fakeWindow('?page=2');
    const { reconcilePage } = createListState({ windowRef: /** @type {any} */ (windowRef) });

    expect(reconcilePage(2, 5)).toBe(false);
  });
});

describe('list-state – sanitizeUrlOnLoad', () => {
  it('rewrites an invalid URL with replaceState', () => {
    const { windowRef, replaceState } = fakeWindow('?page=0&sort=nope&bogus=1');
    const { sanitizeUrlOnLoad } = createListState({ windowRef: /** @type {any} */ (windowRef) });

    sanitizeUrlOnLoad();

    expect(replaceState).toHaveBeenCalled();
    expect(windowRef.location.search).not.toContain('bogus');
    expect(windowRef.location.search).not.toContain('sort=nope');
  });

  it('leaves a valid URL untouched', () => {
    const { windowRef, replaceState } = fakeWindow('?page=2&sort=price&order=desc');
    const { sanitizeUrlOnLoad } = createListState({ windowRef: /** @type {any} */ (windowRef) });

    sanitizeUrlOnLoad();
    expect(replaceState).not.toHaveBeenCalled();
  });
});
