/**
 * Public API of the "product" entity slice.
 *
 * Brand and material lookups were merged here because in this domain they are
 * one-line wrappers around two GET endpoints; separate slices/layers would be
 * over-engineering. They are re-exported from this single public entry point.
 */
export { fetchProducts, fetchProduct, updateProduct } from './api.js';
export { fetchBrands } from './brand.js';
export { fetchMaterials } from './material.js';

export {
  PER_PAGE,
  SORTABLE_COLUMNS,
  DEFAULT_SORT,
  DEFAULT_ORDER,
  defaultState,
  isSortKey,
  normalizePriceFilter,
  sanitizeState,
  buildQueryString,
  buildListQuery,
  buildExportQuery,
  buildListUrl,
  buildExportUrl,
  stateFromSearch,
  PRODUCTS_API_PATH,
  EXPORT_API_PATH,
} from './query.js';

export { formatPrice, truncate } from './format.js';
