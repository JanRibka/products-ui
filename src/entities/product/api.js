import { getJson, putJson } from '../../shared/api/http.js';
import { buildListUrl } from './query.js';

/**
 * @typedef {Object} Product
 * @property {number} id
 * @property {string} code
 * @property {string} name
 * @property {string|null} description
 * @property {string} price        // string with 2 decimals
 * @property {number} brandId
 * @property {string} brandName
 * @property {number} materialId
 * @property {string} materialName
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @typedef {Object} ProductsMeta
 * @property {number} page
 * @property {number} perPage
 * @property {number} total
 * @property {number} totalPages
 */

/**
 * @typedef {Object} ProductsResponse
 * @property {Product[]} data
 * @property {ProductsMeta} meta
 */

/**
 * Fetch the paginated product list.
 * @param {import('./query.js').ListState} state
 * @param {AbortSignal} [signal]
 * @returns {Promise<ProductsResponse>}
 */
export function fetchProducts(state, signal) {
  return getJson(buildListUrl(state), signal);
}

/**
 * Fetch a single product.
 * @param {number} id
 * @param {AbortSignal} [signal]
 * @returns {Promise<Product>}
 */
export function fetchProduct(id, signal) {
  return getJson(`/api/products/${id}`, signal);
}

/**
 * Update a product.
 * @param {number} id
 * @param {Record<string, unknown>} payload
 * @param {AbortSignal} [signal]
 * @returns {Promise<Product>}
 */
export function updateProduct(id, payload, signal) {
  return putJson(`/api/products/${id}`, payload, signal);
}
