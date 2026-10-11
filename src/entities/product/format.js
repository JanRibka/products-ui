/**
 * Display formatting helpers.
 *
 * The API returns prices as strings with two decimals (e.g. "1890.00").
 * For display we parse them with `Number` only to feed Intl.NumberFormat;
 * no arithmetic is done on them. The raw string is never mutated.
 */

/** @type {Intl.NumberFormat | undefined} */
let priceFormatter;

/**
 * Format a price string as Czech currency, e.g. "1890.00" -> "1 890,00 Kč".
 * Falls back to "<value> Kč" when the value is not a finite number.
 *
 * @param {string | number | null | undefined} value
 * @returns {string}
 */
export function formatPrice(value) {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  const numeric = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));

  if (!Number.isFinite(numeric)) {
    return `${value} Kč`;
  }

  priceFormatter ??= new Intl.NumberFormat('cs-CZ', {
    style: 'currency',
    currency: 'CZK',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return priceFormatter.format(numeric);
}

/**
 * Truncate a string for a table cell. Full text stays available via a title
 * attribute (set by the caller) so nothing is lost.
 *
 * @param {string | null | undefined} text
 * @param {number} max
 * @returns {string}
 */
export function truncate(text, max) {
  const value = String(text ?? '');
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, Math.max(0, max - 1))}…`;
}
