import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderProductTable } from '../src/widgets/product-table/product-table.js';
import { defaultState } from '../src/entities/product/query.js';

/** @returns {import('../src/entities/product/api.js').ProductsMeta} */
function meta(overrides = {}) {
  return { page: 1, perPage: 10, total: 1, totalPages: 1, ...overrides };
}

const HOSTILE = '<img src=x onerror=alert(1)>';

/** @type {import('../src/entities/product/api.js').Product} */
const hostileProduct = {
  id: 1,
  code: HOSTILE,
  name: HOSTILE,
  description: HOSTILE,
  price: '1890.00',
  brandId: 1,
  brandName: HOSTILE,
  materialId: 1,
  materialName: HOSTILE,
  createdAt: '2026-10-06T21:44:27+00:00',
  updatedAt: '2026-10-06T21:44:27+00:00',
};

function defaultHandlers() {
  return { onSort: vi.fn(), onPage: vi.fn(), onEdit: vi.fn() };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('product-table – structure', () => {
  it('renders one row per product with an edit action', () => {
    const node = renderProductTable({
      products: [hostileProduct],
      meta: meta(),
      state: defaultState(),
      handlers: defaultHandlers(),
    });

    expect(node.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(node.querySelector('tbody .button')?.textContent).toBe('Upravit');
  });

  it('renders sortable headers as buttons with aria-sort', () => {
    const node = renderProductTable({
      products: [],
      meta: meta(),
      state: { ...defaultState(), sort: 'price', order: 'desc' },
      handlers: defaultHandlers(),
    });

    const sortedHeader = node.querySelector('th[aria-sort="descending"] .sort-button');
    expect(sortedHeader).not.toBeNull();
    expect(sortedHeader?.tagName).toBe('BUTTON');
    // Non-sortable column (description) has no button and no aria-sort.
    const descTh = node.querySelector('th.cell--desc');
    expect(descTh?.getAttribute('aria-sort')).toBeNull();
    expect(descTh?.querySelector('button')).toBeNull();
  });

  it('toggles order on repeated clicks of the active column', () => {
    const handlers = defaultHandlers();
    const node = renderProductTable({
      products: [],
      meta: meta(),
      state: { ...defaultState(), sort: 'name', order: 'asc' },
      handlers,
    });

    node
      .querySelector('th[aria-sort="ascending"] .sort-button')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(handlers.onSort).toHaveBeenCalledWith('name', 'desc');
  });

  it('requests ascending when clicking a different column', () => {
    const handlers = defaultHandlers();
    const node = renderProductTable({
      products: [],
      meta: meta(),
      state: { ...defaultState(), sort: 'code', order: 'desc' },
      handlers,
    });

    // Click "Značka" (brand) while "code" is active.
    const headers = node.querySelectorAll('thead .sort-button');
    const brandButton = [...headers].find((b) => b.textContent?.includes('Značka'));
    brandButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(handlers.onSort).toHaveBeenCalledWith('brand', 'asc');
  });

  it('shows pagination only when there is more than one page', () => {
    const single = renderProductTable({
      products: [],
      meta: meta({ totalPages: 1 }),
      state: defaultState(),
      handlers: defaultHandlers(),
    });
    expect(single.querySelector('.pagination')).toBeNull();

    const many = renderProductTable({
      products: [],
      meta: meta({ totalPages: 3, total: 30 }),
      state: defaultState(),
      handlers: defaultHandlers(),
    });
    expect(many.querySelector('.pagination')).not.toBeNull();
  });
});

describe('product-table – XSS safety', () => {
  it('does not interpret hostile strings as HTML', () => {
    const node = renderProductTable({
      products: [hostileProduct],
      meta: meta(),
      state: defaultState(),
      handlers: defaultHandlers(),
    });

    document.body.append(node);

    // No <img> element must exist; the hostile text is literal.
    expect(document.querySelector('img')).toBeNull();
    expect(node.querySelector('tbody td')?.textContent).toBe(HOSTILE);
    // Text is present in full (code column), not parsed.
    expect(node.textContent).toContain(HOSTILE);
  });

  it('keeps the full description in a title attribute', () => {
    const node = renderProductTable({
      products: [hostileProduct],
      meta: meta(),
      state: defaultState(),
      handlers: defaultHandlers(),
    });

    const descCell = node.querySelector('td.cell--desc');
    expect(descCell?.getAttribute('title')).toBe(HOSTILE);
  });
});
