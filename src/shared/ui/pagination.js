import { el } from '../lib/dom.js';

/**
 * Build the page items to render, collapsing long ranges with ellipses.
 *
 * Example (current=6, total=12):
 *   [1, '…', 5, 6, 7, '…', 12]
 *
 * @param {number} current
 * @param {number} total
 * @param {{ siblingCount?: number }} [options]
 * @returns {(number | 'ellipsis')[]}
 */
export function buildPageItems(current, total, { siblingCount = 1 } = {}) {
  if (total <= 0) {
    return [];
  }
  if (current < 1) {
    current = 1;
  }
  if (current > total) {
    current = total;
  }

  const totalNumbers = siblingCount * 2 + 5; // first, last, current, 2*ellipsis slots
  if (total <= totalNumbers) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const leftSibling = Math.max(current - siblingCount, 1);
  const rightSibling = Math.min(current + siblingCount, total);

  const showLeftEllipsis = leftSibling > 2;
  const showRightEllipsis = rightSibling < total - 1;

  /** @type {(number | 'ellipsis')[]} */
  const items = [1];

  if (showLeftEllipsis) {
    items.push('ellipsis');
  }

  const start = showLeftEllipsis ? leftSibling : 2;
  const end = showRightEllipsis ? rightSibling : total - 1;

  for (let page = start; page <= end; page++) {
    items.push(page);
  }

  if (showRightEllipsis) {
    items.push('ellipsis');
  }

  items.push(total);

  return items;
}

/**
 * Render a pagination nav.
 *
 * @param {Object} options
 * @param {number} options.page       current page (1-based)
 * @param {number} options.totalPages
 * @param {(page: number) => void} options.onNavigate
 * @param {boolean} [options.disabled]
 * @returns {HTMLElement}
 */
export function renderPagination({ page, totalPages, onNavigate, disabled = false }) {
  const nav = el('nav', { class: 'pagination', 'aria-label': 'Stránkování' });

  if (totalPages <= 1) {
    return nav;
  }

  const makeButton = (
    /** @type {string} */ label,
    /** @type {number} */ targetPage,
    /** @type {{ ariaLabel: string, current?: boolean, disabled?: boolean }} */ opts,
  ) => {
    /** @type {Record<string, string | boolean>} */
    const attrs = {
      type: 'button',
      class: 'pagination__button',
      'aria-label': opts.ariaLabel,
    };
    if (opts.current) {
      attrs['aria-current'] = 'page';
    }
    const button = el('button', attrs, [label]);
    button.disabled = disabled || Boolean(opts.disabled);
    button.addEventListener('click', () => {
      if (!button.disabled && targetPage !== page) {
        onNavigate(targetPage);
      }
    });
    return button;
  };

  // Previous
  nav.append(
    makeButton('‹ Předchozí', page - 1, {
      ariaLabel: 'Předchozí stránka',
      disabled: page <= 1,
    }),
  );

  const list = el('ul', { class: 'pagination__list' });

  for (const item of buildPageItems(page, totalPages)) {
    if (item === 'ellipsis') {
      list.append(
        el('li', { class: 'pagination__item pagination__item--ellipsis', 'aria-hidden': 'true' }, [
          '…',
        ]),
      );
      continue;
    }

    const isCurrent = item === page;
    const button = makeButton(String(item), item, {
      ariaLabel: `Stránka ${item}`,
      current: isCurrent,
    });
    list.append(el('li', { class: 'pagination__item' }, [button]));
  }

  nav.append(list);

  // Next
  nav.append(
    makeButton('Další ›', page + 1, {
      ariaLabel: 'Další stránka',
      disabled: page >= totalPages,
    }),
  );

  return nav;
}
