/**
 * List state <-> query string. SINGLE source of truth for both the list
 * request and the CSV export link, so the two can never diverge.
 *
 * State shape:
 *   {
 *     page: number,          // >= 1
 *     sort: 'code'|'name'|'price'|'brand'|'material',
 *     order: 'asc'|'desc',
 *     brandId: number|null,
 *     materialId: number|null,
 *     priceFrom: string|null, // numeric string, kept as-is
 *     priceTo: string|null,
 *     search: string
 *   }
 *
 * Mirrors `App\DataObject\Data\ProductListQuery` in the API.
 */

export const PER_PAGE = 10;

/** @typedef {'code'|'name'|'price'|'brand'|'material'} SortKey */
/** @typedef {'asc'|'desc'} SortOrder */

/** Whitelist of sortable columns the API supports. @type {readonly SortKey[]} */
export const SORTABLE_COLUMNS = /** @type {const} */ ([
  'code',
  'name',
  'price',
  'brand',
  'material',
]);

export const DEFAULT_SORT = /** @type {const} */ ('code');
export const DEFAULT_ORDER = /** @type {const} */ ('asc');

/**
 * @typedef {Object} ListState
 * @property {number} page
 * @property {SortKey} sort
 * @property {SortOrder} order
 * @property {number|null} brandId
 * @property {number|null} materialId
 * @property {string|null} priceFrom
 * @property {string|null} priceTo
 * @property {string} search
 */

/** @returns {ListState} */
export function defaultState() {
  return {
    page: 1,
    sort: DEFAULT_SORT,
    order: DEFAULT_ORDER,
    brandId: null,
    materialId: null,
    priceFrom: null,
    priceTo: null,
    search: '',
  };
}

/**
 * @param {unknown} value
 * @returns {value is SortKey}
 */
export function isSortKey(value) {
  return typeof value === 'string' && SORTABLE_COLUMNS.includes(/** @type {SortKey} */ (value));
}

/**
 * @param {unknown} value
 * @param {number} [min]
 * @returns {number|null}
 */
function toPositiveInt(value, min = 1) {
  if (typeof value === 'number' && Number.isInteger(value) && value >= min) {
    return value;
  }
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    const parsed = Number(value.trim());
    if (Number.isInteger(parsed) && parsed >= min) {
      return parsed;
    }
  }
  return null;
}

/**
 * A price filter value: trimmed numeric string (may contain a decimal point or
 * comma). Anything non-numeric becomes null. We keep it a string - it is never
 * used for arithmetic.
 * @param {unknown} value
 * @returns {string|null}
 */
export function normalizePriceFilter(value) {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : null;
  }
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim().replace(',', '.');
  if (trimmed === '' || !/^\d+(\.\d+)?$/.test(trimmed)) {
    return null;
  }
  return trimmed;
}

/**
 * Sanitize an arbitrary (e.g. URL-derived) object into a valid ListState.
 * Never trusts input: invalid values fall back to defaults.
 *
 * @param {Record<string, unknown> | null | undefined} input
 * @returns {ListState}
 */
export function sanitizeState(input) {
  const source = input ?? {};
  const state = defaultState();

  state.page = toPositiveInt(source.page, 1) ?? 1;
  state.sort = isSortKey(source.sort) ? source.sort : DEFAULT_SORT;
  state.order = source.order === 'desc' ? 'desc' : source.order === 'asc' ? 'asc' : DEFAULT_ORDER;

  state.brandId = toPositiveInt(source.brandId, 1);
  state.materialId = toPositiveInt(source.materialId, 1);
  state.priceFrom = normalizePriceFilter(source.priceFrom);
  state.priceTo = normalizePriceFilter(source.priceTo);
  state.search = typeof source.search === 'string' ? source.search.trim() : '';

  return state;
}

/**
 * Build the query-string fragment for a given state.
 *
 * Defaults are omitted for a clean URL, EXCEPT `page` which is only included
 * by `buildListQuery` (the export must not carry `page`).
 *
 * @param {ListState} state
 * @param {{ includePage?: boolean }} [options]
 * @returns {string}  without a leading "?"
 */
export function buildQueryString(state, { includePage = true } = {}) {
  const params = new URLSearchParams();

  if (includePage && state.page > 1) {
    params.set('page', String(state.page));
  }
  if (state.sort !== DEFAULT_SORT) {
    params.set('sort', state.sort);
  }
  if (state.order !== DEFAULT_ORDER) {
    params.set('order', state.order);
  }
  if (state.brandId !== null) {
    params.set('brandId', String(state.brandId));
  }
  if (state.materialId !== null) {
    params.set('materialId', String(state.materialId));
  }
  if (state.priceFrom !== null) {
    params.set('priceFrom', state.priceFrom);
  }
  if (state.priceTo !== null) {
    params.set('priceTo', state.priceTo);
  }
  if (state.search !== '') {
    params.set('search', state.search);
  }

  return params.toString();
}

/**
 * Query string for the list request (includes page).
 * @param {ListState} state
 * @returns {string}
 */
export function buildListQuery(state) {
  return buildQueryString(state, { includePage: true });
}

/**
 * Query string for the CSV export (no page, everything else identical).
 * @param {ListState} state
 * @returns {string}
 */
export function buildExportQuery(state) {
  return buildQueryString(state, { includePage: false });
}

export const PRODUCTS_API_PATH = '/api/products';
export const EXPORT_API_PATH = '/api/products/export';

/**
 * Full URL for the paginated list request.
 * @param {ListState} state
 * @returns {string}
 */
export function buildListUrl(state) {
  const qs = buildListQuery(state);
  return qs === '' ? PRODUCTS_API_PATH : `${PRODUCTS_API_PATH}?${qs}`;
}

/**
 * Full URL for the CSV export link.
 * @param {ListState} state
 * @returns {string}
 */
export function buildExportUrl(state) {
  const qs = buildExportQuery(state);
  return qs === '' ? EXPORT_API_PATH : `${EXPORT_API_PATH}?${qs}`;
}

/**
 * Parse the current browser search string into a sanitized ListState.
 * @param {string} [search] e.g. window.location.search
 * @returns {ListState}
 */
export function stateFromSearch(search = '') {
  const params = new URLSearchParams(search);
  /** @type {Record<string, unknown>} */
  const raw = {};
  for (const key of [
    'page',
    'sort',
    'order',
    'brandId',
    'materialId',
    'priceFrom',
    'priceTo',
    'search',
  ]) {
    const value = params.get(key);
    if (value !== null) {
      raw[key] = value;
    }
  }
  return sanitizeState(raw);
}
