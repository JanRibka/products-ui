import { getJson } from '../../shared/api/http.js';

/**
 * @typedef {Object} Lookup
 * @property {number} id
 * @property {string} name
 */

/**
 * Fetch the brand lookup list.
 * @param {AbortSignal} [signal]
 * @returns {Promise<Lookup[]>}
 */
export function fetchBrands(signal) {
  return getJson('/api/brands', signal);
}
