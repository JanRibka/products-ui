/**
 * Thin fetch wrapper that maps the API's JSON error contract to typed errors.
 *
 * The API always answers with JSON:
 *   - generic errors:  { error: 'notFound' | 'methodNotAllowed' | 'serverError' | ..., message }
 *   - validation 422:  { validationError: [ { <field>: [<key>, ...] } ] }
 */

/**
 * @typedef {Object} ValidationFieldErrors
 * @property {Record<string, string[]>} fields  field name -> message keys
 * @property {string[]} generic                 form-level message keys (unknown keys)
 */

export class ApiError extends Error {
  /**
   * @param {string} message
   * @param {Object} [options]
   * @param {number} [options.status]
   * @param {string} [options.errorKey]
   * @param {ValidationFieldErrors} [options.validation]
   */
  constructor(message, { status = 0, errorKey = 'unknown', validation } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errorKey = errorKey;
    /** @type {ValidationFieldErrors | undefined} */
    this.validation = validation;
  }
}

export class NetworkError extends ApiError {
  /**
   * @param {string} message
   * @param {Error} [cause]
   */
  constructor(message, cause) {
    super(message, { status: 0, errorKey: 'network' });
    this.name = 'NetworkError';
    if (cause) {
      this.cause = cause;
    }
  }
}

export class AbortError extends ApiError {
  constructor() {
    super('Request aborted', { status: 0, errorKey: 'aborted' });
    this.name = 'AbortError';
  }
}

/**
 * Normalize the API's `validationError` payload into a field map.
 * The payload is `[{field: [keys]}, ...]`; multiple objects are merged and
 * duplicate keys within a field are removed. Unknown keys are kept as-is here
 * (the UI layer decides the field mapping / generic fallback).
 *
 * @param {unknown} payload
 * @returns {ValidationFieldErrors}
 */
export function parseValidationError(payload) {
  /** @type {Record<string, string[]>} */
  const fields = {};

  if (Array.isArray(payload)) {
    for (const group of payload) {
      if (!group || typeof group !== 'object') {
        continue;
      }
      for (const [field, keys] of Object.entries(group)) {
        if (!Array.isArray(keys)) {
          continue;
        }
        const existing = fields[field] ?? (fields[field] = []);
        for (const key of keys) {
          if (typeof key === 'string' && !existing.includes(key)) {
            existing.push(key);
          }
        }
      }
    }
  }

  return { fields, generic: [] };
}

/**
 * Read a response body as JSON, tolerating empty/non-JSON bodies.
 * @param {Response} response
 * @returns {Promise<any>}
 */
async function readJson(response) {
  const text = await response.text();
  if (text === '') {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Perform a JSON request. Throws:
 *  - AbortError when the caller aborts,
 *  - NetworkError when the transport fails,
 *  - ApiError with `.status`, `.errorKey` and (for 422) `.validation`.
 *
 * @param {string} url
 * @param {RequestInit} [options]
 * @returns {Promise<any>}
 */
export async function requestJson(url, options = {}) {
  let response;
  try {
    response = await fetch(url, {
      headers: { Accept: 'application/json', ...(options.headers ?? {}) },
      ...options,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new AbortError();
    }
    throw new NetworkError('Síťová chyba', /** @type {Error} */ (error));
  }

  const body = await readJson(response);

  if (response.ok) {
    return body;
  }

  // Validation errors (422) carry a field map instead of a flat error key.
  if (body && typeof body === 'object' && 'validationError' in body) {
    throw new ApiError('Validation failed', {
      status: response.status,
      errorKey: 'validationError',
      validation: parseValidationError(body.validationError),
    });
  }

  const errorKey =
    body && typeof body === 'object' && typeof body.error === 'string' ? body.error : 'unknown';
  const message =
    body && typeof body === 'object' && typeof body.message === 'string' ? body.message : '';

  throw new ApiError(message, { status: response.status, errorKey });
}

/**
 * GET JSON with an AbortSignal.
 * @param {string} url
 * @param {AbortSignal} [signal]
 * @returns {Promise<any>}
 */
export function getJson(url, signal) {
  return requestJson(url, { method: 'GET', signal });
}

/**
 * PUT JSON with an AbortSignal.
 * @param {string} url
 * @param {unknown} payload
 * @param {AbortSignal} [signal]
 * @returns {Promise<any>}
 */
export function putJson(url, payload, signal) {
  return requestJson(url, {
    method: 'PUT',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
