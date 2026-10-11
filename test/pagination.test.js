import { describe, expect, it } from 'vitest';
import { buildPageItems, renderPagination } from '../src/shared/ui/pagination.js';

describe('pagination – buildPageItems', () => {
  it('lists all pages when the count is small', () => {
    expect(buildPageItems(1, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it('returns nothing for zero pages', () => {
    expect(buildPageItems(1, 0)).toEqual([]);
  });

  it('collapses the middle with ellipses', () => {
    const items = buildPageItems(6, 12);
    expect(items[0]).toBe(1);
    expect(items.at(-1)).toBe(12);
    expect(items).toContain('ellipsis');
    expect(items).toContain(6);
  });

  it('clamps out-of-range current values', () => {
    expect(buildPageItems(99, 3)).toEqual([1, 2, 3]);
    expect(buildPageItems(-4, 3)).toEqual([1, 2, 3]);
  });
});

describe('pagination – renderPagination', () => {
  it('marks the current page with aria-current and disables edges', () => {
    const node = renderPagination({ page: 1, totalPages: 3, onNavigate: () => {} });

    const current = node.querySelector('[aria-current="page"]');
    expect(current?.textContent).toBe('1');

    const prev = /** @type {HTMLButtonElement | null} */ (
      node.querySelector('[aria-label="Předchozí stránka"]')
    );
    expect(prev?.disabled).toBe(true);

    const next = /** @type {HTMLButtonElement | null} */ (
      node.querySelector('[aria-label="Další stránka"]')
    );
    expect(next?.disabled).toBe(false);
  });

  it('navigates on click', () => {
    let target = 0;
    const node = renderPagination({
      page: 2,
      totalPages: 4,
      onNavigate: (page) => {
        target = page;
      },
    });

    node
      .querySelector('[aria-label="Další stránka"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(target).toBe(3);
  });

  it('renders nothing when there is a single page', () => {
    const node = renderPagination({ page: 1, totalPages: 0, onNavigate: () => {} });
    expect(node.querySelectorAll('button')).toHaveLength(0);
  });
});
