import { clear, el } from '../../shared/lib/dom.js';
import { renderPagination } from '../../shared/ui/pagination.js';
import { formatPrice, truncate } from '../../entities/product/index.js';

/**
 * @typedef {import('../../entities/product/api.js').Product} Product
 * @typedef {import('../../entities/product/query.js').ListState} ListState
 * @typedef {import('../../entities/product/query.js').SortKey} SortKey
 */

/**
 * Columns. `sortable` mirrors the API sort whitelist exactly.
 * @type {{ key: string, label: string, sort?: SortKey, className?: string }[]}
 */
const COLUMNS = [
  { key: 'code', label: 'Kód', sort: 'code' },
  { key: 'name', label: 'Název', sort: 'name' },
  { key: 'description', label: 'Popis', className: 'cell--desc' },
  { key: 'brandName', label: 'Značka', sort: 'brand' },
  { key: 'materialName', label: 'Materiál', sort: 'material' },
  { key: 'price', label: 'Cena', sort: 'price', className: 'cell--number' },
];

/**
 * @typedef {Object} ProductTableHandlers
 * @property {(sort: SortKey, order: 'asc'|'desc') => void} onSort
 * @property {(page: number) => void} onPage
 * @property {(product: Product, trigger: HTMLElement) => void} onEdit
 */

/**
 * Render the whole table region: sortable <thead>, <tbody>, and pagination.
 * The caller decides which region to render based on the request status.
 *
 * @param {Object} options
 * @param {Product[]} options.products
 * @param {import('../../entities/product/api.js').ProductsMeta} options.meta
 * @param {ListState} options.state
 * @param {ProductTableHandlers} options.handlers
 * @param {boolean} [options.busy]
 * @returns {HTMLElement}
 */
export function renderProductTable({ products, meta, state, handlers, busy = false }) {
  const wrapper = el('div', { class: 'table-wrap' });
  const table = el('table', { class: 'product-table' });

  table.append(renderHead(state, handlers, busy));
  table.append(renderBody(products, handlers, busy));
  wrapper.append(table);

  if (meta.totalPages > 1) {
    wrapper.append(
      renderPagination({
        page: meta.page,
        totalPages: meta.totalPages,
        disabled: busy,
        onNavigate: handlers.onPage,
      }),
    );
  }

  return wrapper;
}

/**
 * @param {ListState} state
 * @param {ProductTableHandlers} handlers
 * @param {boolean} busy
 * @returns {HTMLTableSectionElement}
 */
function renderHead(state, handlers, busy) {
  const thead = el('thead');
  const row = el('tr');

  for (const column of COLUMNS) {
    const th = el('th', { scope: 'col', class: column.className ?? null });

    const sortKey = column.sort;
    if (sortKey) {
      const isActive = state.sort === sortKey;
      th.setAttribute(
        'aria-sort',
        isActive ? (state.order === 'asc' ? 'ascending' : 'descending') : 'none',
      );

      const label = column.label + (isActive ? (state.order === 'asc' ? ' ↑' : ' ↓') : '');
      const button = el(
        'button',
        {
          type: 'button',
          class: 'sort-button',
          'aria-label': `Seřadit podle: ${column.label}`,
        },
        [label],
      );
      button.disabled = busy;

      button.addEventListener('click', () => {
        const nextOrder = isActive && state.order === 'asc' ? 'desc' : 'asc';
        handlers.onSort(sortKey, nextOrder);
      });

      th.append(button);
    } else {
      th.textContent = column.label;
    }

    row.append(th);
  }

  row.append(el('th', { scope: 'col', class: 'cell--action', text: 'Akce' }));
  thead.append(row);

  return thead;
}

/**
 * @param {Product[]} products
 * @param {ProductTableHandlers} handlers
 * @param {boolean} busy
 * @returns {HTMLTableSectionElement}
 */
function renderBody(products, handlers, busy) {
  const tbody = el('tbody');

  for (const product of products) {
    const row = el('tr');

    row.append(el('td', { 'data-label': 'Kód' }, [el('code', { text: product.code })]));
    row.append(el('td', { 'data-label': 'Název', text: product.name }));

    const description = product.description ?? '';
    row.append(
      el('td', { class: 'cell--desc', 'data-label': 'Popis', title: description }, [
        el('span', { text: truncate(description, 60) }),
      ]),
    );

    row.append(el('td', { 'data-label': 'Značka', text: product.brandName }));
    row.append(el('td', { 'data-label': 'Materiál', text: product.materialName }));
    row.append(
      el('td', { class: 'cell--number', 'data-label': 'Cena', text: formatPrice(product.price) }),
    );

    const editButton = el(
      'button',
      {
        type: 'button',
        class: 'button button--ghost',
        'aria-label': `Upravit produkt ${product.code}`,
      },
      ['Upravit'],
    );
    editButton.disabled = busy;
    editButton.addEventListener('click', () => handlers.onEdit(product, editButton));
    row.append(el('td', { class: 'cell--action', 'data-label': 'Akce' }, [editButton]));

    tbody.append(row);
  }

  return tbody;
}

/**
 * Remove a node's children in a safe way (kept here so the page has one way
 * to clear the table region).
 * @param {HTMLElement} node
 */
export function clearTableRegion(node) {
  clear(node);
}
