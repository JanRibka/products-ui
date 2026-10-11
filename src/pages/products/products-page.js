import { clear, el } from '../../shared/lib/dom.js';
import { ApiError } from '../../shared/api/http.js';
import { translateErrorKey } from '../../shared/lib/error-messages.js';
import { fetchBrands, fetchMaterials, fetchProducts } from '../../entities/product/index.js';
import { renderProductTable } from '../../widgets/product-table/index.js';
import { renderProductFilters } from '../../features/product-filters/index.js';
import { renderProductExport } from '../../features/product-export/index.js';
import { createProductEditDialog } from '../../features/product-edit/index.js';
import { createListState } from './model/list-state.js';

/**
 * Build the products page inside `root`.
 *
 * The store subscription is the SINGLE driver of list fetching: every state
 * change (filters, sort, page, popstate) writes to the store, which triggers
 * exactly one refresh.
 *
 * @param {HTMLElement} root
 * @param {{ windowRef?: Window }} [options]
 */
export function mountProductsPage(root, { windowRef = window } = {}) {
  clear(root);

  // ----- layout skeleton (built once; regions are swapped in place) -----
  const toolbar = el('div', { class: 'toolbar' });
  const filtersRegion = el('section', { class: 'filters-region', 'aria-label': 'Filtrování' });
  const statusRegion = el('p', {
    class: 'status live-region',
    role: 'status',
    'aria-live': 'polite',
    'aria-atomic': 'true',
  });
  const errorRegion = el('div', { class: 'error-region', hidden: 'hidden' });
  const tableRegion = el('div', { class: 'table-region', 'aria-busy': 'false' });

  const exportControl = renderProductExport();

  const editDialog = createProductEditDialog({
    getLookups: ensureLookups,
    onSaved: () => refresh({ force: true }),
    onNotFound: () => refresh({ force: true }),
  });

  toolbar.append(
    el('h2', { class: 'toolbar__title', text: 'Seznam produktů' }),
    exportControl.element,
  );

  root.append(toolbar, filtersRegion, statusRegion, errorRegion, tableRegion, editDialog.element);

  // ----- state -----
  const listState = createListState({ windowRef });
  const { store, update, goToPage, reconcilePage, sanitizeUrlOnLoad, syncFromUrl } = listState;

  // Sanitize invalid values in the URL up front (never trust the URL).
  sanitizeUrlOnLoad();

  // ----- lookups (brands / materials), loaded once -----
  /** @type {{ brands: import('../../entities/product/brand.js').Lookup[], materials: import('../../entities/product/material.js').Lookup[] } | null} */
  let lookups = null;
  /** @type {Promise<{ brands: any[], materials: any[] }> | null} */
  let lookupsPromise = null;

  function ensureLookups() {
    if (lookups) {
      return Promise.resolve(lookups);
    }
    lookupsPromise ??= Promise.all([fetchBrands(), fetchMaterials()]).then(
      ([brands, materials]) => {
        lookups = { brands, materials };
        return lookups;
      },
    );
    return lookupsPromise;
  }

  // ----- filters -----
  const filters = renderProductFilters(store.get(), {
    onChange: (patch) => update(patch),
    onReset: () =>
      update({ brandId: null, materialId: null, priceFrom: null, priceTo: null, search: '' }),
  });
  filtersRegion.append(filters.element);

  void ensureLookups()
    .then(({ brands, materials }) => filters.populate(brands, materials))
    .catch(() => {
      /* lookup failure only degrades the filter selects; the list still works */
    });

  // ----- request lifecycle -----
  /** @type {AbortController | null} */
  let listController = null;
  /** Monotonic id: a stale response can never overwrite a newer one. */
  let requestSeq = 0;

  /**
   * Fetch and render the list for the current state.
   * @param {{ force?: boolean }} [options]
   */
  async function refresh(options = {}) {
    const state = store.get();

    // Cancel the previous in-flight request.
    listController?.abort();
    listController = new AbortController();
    const seq = ++requestSeq;
    const signal = listController.signal;

    setBusy(true);
    hideError();

    try {
      const result = await fetchProducts(state, signal);

      // Stale response guard (belt-and-braces alongside AbortController).
      if (seq !== requestSeq) {
        return;
      }

      const totalPages = result.meta?.totalPages ?? 0;

      // Out-of-range page -> jump to the last page (replaceState, no entry).
      if (!options.force && totalPages > 0 && state.page > totalPages) {
        reconcilePage(state.page, totalPages);
        return; // the store change re-triggers refresh()
      }
      // Completely empty dataset -> force page 1 (and the empty state).
      if (!options.force && totalPages === 0 && state.page !== 1) {
        reconcilePage(1, 0);
        return;
      }

      renderList(result);
      announceResult(result);
    } catch (error) {
      if (error instanceof ApiError && error.errorKey === 'aborted') {
        return;
      }
      if (seq !== requestSeq) {
        return;
      }
      renderListError(error);
    } finally {
      if (seq === requestSeq) {
        setBusy(false);
      }
    }
  }

  /** @param {import('../../entities/product/api.js').ProductsResponse} result */
  function renderList(result) {
    const state = store.get();
    hideError();

    // Export link always mirrors the applied filter/sort (never includes a stale page).
    exportControl.update(state);

    if (result.data.length === 0) {
      clear(tableRegion);
      tableRegion.append(renderEmptyState());
      return;
    }

    clear(tableRegion);
    tableRegion.append(
      renderProductTable({
        products: result.data,
        meta: result.meta,
        state,
        handlers: {
          onSort: (sort, order) => update({ sort, order }),
          onPage: (page) => goToPage(page),
          onEdit: (product, trigger) => editDialog.open(product, trigger),
        },
      }),
    );
  }

  /** @param {import('../../entities/product/api.js').ProductsResponse} result */
  function announceResult(result) {
    const { total, page, totalPages } = result.meta;
    statusRegion.textContent =
      total === 0
        ? 'Nenalezeny žádné produkty.'
        : `Nalezeno ${total} produktů, stránka ${page} z ${totalPages}.`;
  }

  /** @returns {HTMLElement} */
  function renderEmptyState() {
    return el('div', { class: 'empty-state' }, [
      el('p', { class: 'empty-state__title', text: 'Nenalezeny žádné produkty' }),
      el('p', { class: 'empty-state__hint', text: 'Zkuste upravit nebo zrušit filtry.' }),
    ]);
  }

  /** @param {unknown} error */
  function renderListError(error) {
    clear(tableRegion);

    const message =
      error instanceof ApiError && error.status !== 0
        ? translateErrorKey(error.errorKey)
        : translateErrorKey('network');

    errorRegion.hidden = false;
    errorRegion.replaceChildren(
      el('p', { class: 'error-region__message', text: message }),
      retryButton(),
    );

    statusRegion.textContent = 'Načtení dat se nezdařilo.';
  }

  function retryButton() {
    const button = el('button', {
      type: 'button',
      class: 'button button--primary',
      text: 'Zkusit znovu',
    });
    button.addEventListener('click', () => refresh({ force: true }));
    return button;
  }

  function hideError() {
    errorRegion.hidden = true;
    errorRegion.replaceChildren();
  }

  /** @param {boolean} busy */
  function setBusy(busy) {
    tableRegion.setAttribute('aria-busy', busy ? 'true' : 'false');
    tableRegion.classList.toggle('is-loading', busy);
    if (busy) {
      statusRegion.textContent = 'Načítám…';
    }
  }

  // ----- reactivity: store is the single driver of fetching -----
  store.subscribe(() => {
    void refresh();
  });

  windowRef.addEventListener('popstate', () => {
    syncFromUrl();
  });

  // Initial load.
  exportControl.update(store.get());
  void refresh();

  return { refresh, store };
}
