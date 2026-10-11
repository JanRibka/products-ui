import { el } from '../../shared/lib/dom.js';
import { buildExportUrl } from '../../entities/product/index.js';

/**
 * @typedef {import('../../entities/product/query.js').ListState} ListState
 */

/**
 * Create the CSV export control: a plain anchor whose href is rebuilt from the
 * SAME state through the SAME query module as the list request (minus page).
 * The API delivers the CSV as an attachment, so a normal link download works.
 *
 * @returns {{ element: HTMLAnchorElement, update: (state: ListState) => void }}
 */
export function renderProductExport() {
  const link = el(
    'a',
    {
      class: 'button button--primary',
      href: '/api/products/export',
      download: 'products.csv',
      'aria-label': 'Exportovat aktuálně filtrované produkty do CSV',
    },
    ['Exportovat CSV'],
  );

  return {
    element: link,
    update(state) {
      link.href = buildExportUrl(state);
    },
  };
}
