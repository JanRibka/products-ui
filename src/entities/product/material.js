import { getJson } from '../../shared/api/http.js';

/**
 * @typedef {import('./brand.js').Lookup} Lookup
 */

/**
 * Fetch the material lookup list.
 * @param {AbortSignal} [signal]
 * @returns {Promise<Lookup[]>}
 */
export function fetchMaterials(signal) {
  return getJson('/api/materials', signal);
}
