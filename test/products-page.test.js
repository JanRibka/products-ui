import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountProductsPage } from '../src/pages/products/products-page.js';

/**
 * Fake window with a working history/location so URL sync is exercisable.
 * @param {string} [search]
 */
function fakeWindow(search = '') {
  let current = search;
  const pushState = vi.fn((_s, _t, url) => {
    current = String(url).includes('?') ? `?${String(url).split('?')[1]}` : '';
  });
  const replaceState = vi.fn((_s, _t, url) => {
    current = String(url).includes('?') ? `?${String(url).split('?')[1]}` : '';
  });
  const listeners = new Set();
  const windowRef = {
    location: {
      pathname: '/',
      get search() {
        return current;
      },
    },
    history: { pushState, replaceState },
    /**
     * @param {string} type
     * @param {EventListener} handler
     */
    addEventListener: (type, handler) => {
      if (type === 'popstate') listeners.add(handler);
    },
    /**
     * @param {string} _type
     * @param {EventListener} handler
     */
    removeEventListener: (_type, handler) => listeners.delete(handler),
  };
  return { windowRef, pushState, replaceState };
}

/** @param {object} body @param {number} [status] */
function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** @param {number} id */
function product(id) {
  return {
    id,
    code: `PM${String(id).padStart(5, '0')}`,
    name: `Kryt ${id}`,
    description: 'Popis',
    price: '1890.00',
    brandId: 1,
    brandName: 'Audi',
    materialId: 1,
    materialName: 'Plast',
    createdAt: '2026-10-06T21:44:27+00:00',
    updatedAt: '2026-10-06T21:44:27+00:00',
  };
}

/**
 * Route-aware fetch stub.
 * @param {(url: URL) => Promise<Response>} listMock  handler for /api/products
 */
function installFetch(listMock) {
  const fetchMock = vi.fn(async (url, options = {}) => {
    const target = String(url);
    if (target.startsWith('/api/products/export')) {
      return new Response('kód;název\n', { status: 200 });
    }
    if (target.startsWith('/api/products/')) {
      const id = Number(target.split('/').pop());
      return json(product(id));
    }
    if (target.startsWith('/api/products')) {
      if (options.signal?.aborted) {
        throw new DOMException('aborted', 'AbortError');
      }
      return listMock(new URL(target, 'http://localhost'));
    }
    if (target.startsWith('/api/brands')) {
      return json([
        { id: 1, name: 'Audi' },
        { id: 2, name: 'BMW' },
      ]);
    }
    if (target.startsWith('/api/materials')) {
      return json([{ id: 1, name: 'Plast' }]);
    }
    return json({ error: 'notFound', message: 'x' }, 404);
  });

  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** Let pending promises/microtasks flush. */
async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

/** @type {HTMLDivElement} */
let root;

beforeEach(() => {
  root = document.createElement('div');
  document.body.replaceChildren(root);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('products-page – rendering', () => {
  it('renders rows for a successful list response', async () => {
    installFetch(async () =>
      json({
        data: [product(1), product(2)],
        meta: { page: 1, perPage: 10, total: 2, totalPages: 1 },
      }),
    );
    const { windowRef } = fakeWindow('');

    mountProductsPage(root, { windowRef: /** @type {any} */ (windowRef) });
    await flush();

    expect(root.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(root.querySelector('.status')?.textContent).toContain('2 produktů');
  });

  it('shows the empty state when the filtered result is empty', async () => {
    installFetch(async () =>
      json({ data: [], meta: { page: 1, perPage: 10, total: 0, totalPages: 0 } }),
    );
    const { windowRef } = fakeWindow('');

    mountProductsPage(root, { windowRef: /** @type {any} */ (windowRef) });
    await flush();

    expect(root.querySelector('.empty-state')).not.toBeNull();
    expect(root.querySelectorAll('tbody tr')).toHaveLength(0);
    expect(root.querySelector('.status')?.textContent).toContain('Nenalezeny');
  });
});

describe('products-page – out-of-range page handling', () => {
  it('navigates to the last page via replaceState when page > totalPages', async () => {
    installFetch(async () =>
      json({ data: [product(5)], meta: { page: 3, perPage: 10, total: 25, totalPages: 3 } }),
    );
    const { windowRef, replaceState, pushState } = fakeWindow('?page=99');

    mountProductsPage(root, { windowRef: /** @type {any} */ (windowRef) });
    await flush();
    await flush();

    // It must have rewritten to page=3 without adding a history entry.
    expect(replaceState).toHaveBeenCalled();
    expect(pushState).not.toHaveBeenCalled();
    expect(windowRef.location.search).toContain('page=3');
    expect(root.querySelectorAll('tbody tr')).toHaveLength(1);
  });

  it('hides pagination and shows the empty state when totalPages is 0', async () => {
    installFetch(async () =>
      json({ data: [], meta: { page: 1, perPage: 10, total: 0, totalPages: 0 } }),
    );
    const { windowRef } = fakeWindow('');

    mountProductsPage(root, { windowRef: /** @type {any} */ (windowRef) });
    await flush();

    expect(root.querySelector('.empty-state')).not.toBeNull();
    expect(root.querySelector('.pagination')).toBeNull();
  });
});

describe('products-page – error state', () => {
  it('renders an error with a retry button on server error, and recovers on retry', async () => {
    let calls = 0;
    installFetch(async () => {
      calls += 1;
      if (calls === 1) {
        return json({ error: 'serverError', message: 'Internal server error' }, 500);
      }
      return json({ data: [product(1)], meta: { page: 1, perPage: 10, total: 1, totalPages: 1 } });
    });
    const { windowRef } = fakeWindow('');

    mountProductsPage(root, { windowRef: /** @type {any} */ (windowRef) });
    await flush();

    const errorRegion = root.querySelector('.error-region');
    expect(errorRegion?.hasAttribute('hidden')).toBe(false);
    const retry = /** @type {HTMLButtonElement | null} */ (
      root.querySelector('.error-region button')
    );
    expect(retry?.textContent).toBe('Zkusit znovu');

    retry?.click();
    await flush();

    expect(root.querySelector('.error-region')?.hasAttribute('hidden')).toBe(true);
    expect(root.querySelectorAll('tbody tr')).toHaveLength(1);
  });

  it('renders the network error message when the transport fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        if (String(url).startsWith('/api/products')) {
          throw new TypeError('Failed to fetch');
        }
        return json([]);
      }),
    );
    const { windowRef } = fakeWindow('');

    mountProductsPage(root, { windowRef: /** @type {any} */ (windowRef) });
    await flush();

    expect(root.querySelector('.error-region')?.textContent).toContain('spojit se serverem');
  });
});

describe('products-page – export link sync', () => {
  it('keeps the export href in sync with filters (minus page)', async () => {
    installFetch(async () =>
      json({ data: [product(11)], meta: { page: 2, perPage: 10, total: 11, totalPages: 2 } }),
    );
    const { windowRef } = fakeWindow('?page=2&sort=price&order=desc&brandId=1');

    mountProductsPage(root, { windowRef: /** @type {any} */ (windowRef) });
    await flush();

    const link = /** @type {HTMLAnchorElement} */ (root.querySelector('a[download]'));
    expect(link.tagName).toBe('A');
    expect(link.getAttribute('href')).toBe('/api/products/export?sort=price&order=desc&brandId=1');
    expect(link.getAttribute('href')).not.toContain('page=');
  });
});

describe('products-page – race safety', () => {
  it('ignores a stale response (last request wins)', async () => {
    /** @type {() => void} */
    let releaseSecond = () => {};
    /** @type {Promise<void>} */
    const secondPending = new Promise((resolve) => {
      releaseSecond = () => resolve();
    });
    let call = 0;

    installFetch(async () => {
      call += 1;
      // #1: initial load (immediate, 1 row) -> headers are rendered.
      if (call === 1) {
        return json({
          data: [product(1)],
          meta: { page: 1, perPage: 10, total: 1, totalPages: 1 },
        });
      }
      // #2: first sort change -> HELD (this becomes the stale response).
      if (call === 2) {
        await secondPending;
        return json({
          data: [product(1)],
          meta: { page: 1, perPage: 10, total: 1, totalPages: 1 },
        });
      }
      // #3: second sort change -> wins with 2 rows.
      return json({
        data: [product(2), product(3)],
        meta: { page: 1, perPage: 10, total: 2, totalPages: 1 },
      });
    });

    const { windowRef } = fakeWindow('');
    mountProductsPage(root, { windowRef: /** @type {any} */ (windowRef) });
    await flush();
    expect(root.querySelectorAll('tbody tr')).toHaveLength(1);

    /** @param {string} label */
    const clickSort = (label) =>
      [...root.querySelectorAll('.sort-button')]
        .find((b) => b.textContent?.includes(label))
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    clickSort('Cena'); // -> held request (#2)
    await flush();

    clickSort('Název'); // -> wins (#3)
    await flush();
    expect(root.querySelectorAll('tbody tr')).toHaveLength(2);

    // Release the stale response (#2); it must NOT overwrite the newer result.
    releaseSecond();
    await flush();
    await flush();

    expect(root.querySelectorAll('tbody tr')).toHaveLength(2);
  });
});
