import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AbortError,
  ApiError,
  NetworkError,
  getJson,
  parseValidationError,
  requestJson,
} from '../src/shared/api/http.js';

/**
 * @param {unknown} body
 * @param {{ status?: number }} [init]
 */
function jsonResponse(body, { status = 200 } = {}) {
  return new Response(body === null ? '' : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('http.js – success', () => {
  it('returns parsed JSON on 200', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ data: [], meta: {} })),
    );
    const result = await getJson('/api/products');
    expect(result).toEqual({ data: [], meta: {} });
  });

  it('returns null for an empty body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 200 })),
    );
    expect(await getJson('/api/x')).toBeNull();
  });
});

describe('http.js – error mapping', () => {
  it('maps 404 to ApiError with errorKey notFound', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({ error: 'notFound', message: 'Resource not found' }, { status: 404 }),
      ),
    );
    await expect(getJson('/api/products/99')).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
      errorKey: 'notFound',
    });
  });

  it('maps 409 / duplicate as code.unique via validation payload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({ validationError: [{ code: ['code.unique'] }] }, { status: 422 }),
      ),
    );
    try {
      await getJson('/api/products/1');
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      const apiError = /** @type {ApiError} */ (error);
      expect(apiError.status).toBe(422);
      expect(apiError.errorKey).toBe('validationError');
      expect(apiError.validation?.fields).toEqual({ code: ['code.unique'] });
    }
  });

  it('maps 422 validation errors into a field map', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse(
          { validationError: [{ code: ['required'], price: ['price.invalid', 'price.invalid'] }] },
          { status: 422 },
        ),
      ),
    );
    try {
      await requestJson('/api/products/1', { method: 'PUT' });
      expect.unreachable();
    } catch (error) {
      const apiError = /** @type {ApiError} */ (error);
      expect(apiError.validation?.fields.code).toEqual(['required']);
      // duplicates within a field are removed
      expect(apiError.validation?.fields.price).toEqual(['price.invalid']);
    }
  });

  it('maps 500 to ApiError with errorKey serverError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({ error: 'serverError', message: 'Internal server error' }, { status: 500 }),
      ),
    );
    await expect(getJson('/api/products')).rejects.toMatchObject({
      status: 500,
      errorKey: 'serverError',
    });
  });

  it('maps a transport failure to NetworkError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    await expect(getJson('/api/products')).rejects.toBeInstanceOf(NetworkError);
  });

  it('maps DOMException AbortError to our AbortError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new DOMException('aborted', 'AbortError');
      }),
    );
    await expect(getJson('/api/products')).rejects.toBeInstanceOf(AbortError);
  });

  it('returns ApiError for a non-JSON error body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<html>boom</html>', { status: 500 })),
    );
    await expect(getJson('/api/products')).rejects.toMatchObject({
      errorKey: 'unknown',
      status: 500,
    });
  });
});

describe('http.js – parseValidationError', () => {
  it('merges multiple objects and dedupes keys', () => {
    const result = parseValidationError([
      { code: ['required'] },
      { code: ['code.unique'], price: ['price.invalid'] },
      'garbage',
      { name: 'not-an-array' },
    ]);
    expect(result.fields).toEqual({
      code: ['required', 'code.unique'],
      price: ['price.invalid'],
    });
  });

  it('returns empty fields for non-array input', () => {
    expect(parseValidationError(null).fields).toEqual({});
    expect(parseValidationError({ nope: true }).fields).toEqual({});
  });
});
