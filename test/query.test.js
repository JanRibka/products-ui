import { describe, expect, it } from 'vitest';
import {
  buildExportQuery,
  buildExportUrl,
  buildListQuery,
  buildListUrl,
  defaultState,
  normalizePriceFilter,
  sanitizeState,
  stateFromSearch,
} from '../src/entities/product/query.js';

describe('query.js – default state', () => {
  it('produces a clean default state', () => {
    expect(defaultState()).toEqual({
      page: 1,
      sort: 'code',
      order: 'asc',
      brandId: null,
      materialId: null,
      priceFrom: null,
      priceTo: null,
      search: '',
    });
  });
});

describe('query.js – sanitizing invalid input', () => {
  it('falls back to defaults for garbage', () => {
    const state = sanitizeState({
      page: '-3',
      sort: 'DROP TABLE',
      order: 'sideways',
      brandId: '0',
      materialId: 'abc',
      priceFrom: 'NaN',
      priceTo: '<script>',
      search: 42,
    });

    expect(state).toEqual(defaultState());
  });

  it('accepts valid values and trims search', () => {
    const state = sanitizeState({
      page: '3',
      sort: 'price',
      order: 'desc',
      brandId: '4',
      materialId: 2,
      priceFrom: '100',
      priceTo: '2 500',
      search: '  kryt  ',
    });

    expect(state.page).toBe(3);
    expect(state.sort).toBe('price');
    expect(state.order).toBe('desc');
    expect(state.brandId).toBe(4);
    expect(state.materialId).toBe(2);
    expect(state.priceFrom).toBe('100');
    expect(state.priceTo).toBeNull(); // space is not a valid number
    expect(state.search).toBe('kryt');
  });

  it('clamps page 0 / negative to 1', () => {
    expect(sanitizeState({ page: 0 }).page).toBe(1);
    expect(sanitizeState({ page: '-5' }).page).toBe(1);
  });
});

describe('query.js – normalizePriceFilter', () => {
  it('accepts integers, decimals and comma decimals', () => {
    expect(normalizePriceFilter('100')).toBe('100');
    expect(normalizePriceFilter('99.9')).toBe('99.9');
    expect(normalizePriceFilter('12,5')).toBe('12.5');
    expect(normalizePriceFilter(2500)).toBe('2500');
  });

  it('rejects non-numeric values', () => {
    expect(normalizePriceFilter('')).toBeNull();
    expect(normalizePriceFilter('abc')).toBeNull();
    expect(normalizePriceFilter(null)).toBeNull();
    expect(normalizePriceFilter('1e3')).toBeNull();
    expect(normalizePriceFilter('  ')).toBeNull();
  });
});

describe('query.js – round trip state <-> query string', () => {
  it('omits defaults and page=1', () => {
    expect(buildListQuery(defaultState())).toBe('');
    expect(stateFromSearch('')).toEqual(defaultState());
  });

  it('round-trips a fully populated state (list, with page)', () => {
    const state = sanitizeState({
      page: '2',
      sort: 'brand',
      order: 'desc',
      brandId: '1',
      materialId: '3',
      priceFrom: '1500',
      priceTo: '3000',
      search: 'audi',
    });

    const qs = buildListQuery(state);
    expect(stateFromSearch(`?${qs}`)).toEqual(state);
  });

  it('round-trips through the full URL helpers', () => {
    const state = sanitizeState({ page: '4', sort: 'name', order: 'desc', search: 'kryt' });
    const url = buildListUrl(state);
    expect(url).toBe('/api/products?page=4&sort=name&order=desc&search=kryt');
    expect(stateFromSearch(url.split('?')[1])).toEqual(state);
  });
});

describe('query.js – export URL', () => {
  it('equals the list params but without page', () => {
    const state = sanitizeState({
      page: '5',
      sort: 'price',
      order: 'desc',
      brandId: '2',
      materialId: '1',
      priceFrom: '1000',
      priceTo: '2000',
      search: 'bmw',
    });

    expect(buildExportQuery(state)).toBe(buildListQuery(state).replace(/^page=[^&]*&?/, ''));
    expect(buildExportQuery(state)).not.toContain('page=');
    expect(buildListQuery(state)).toContain('page=5');
  });

  it('builds the export path without page even when page=1', () => {
    const state = defaultState();
    expect(buildExportUrl(state)).toBe('/api/products/export');
  });

  it('export URL keeps every filter and sort of the list (minus page)', () => {
    const state = sanitizeState({
      page: '7',
      sort: 'material',
      order: 'desc',
      brandId: '1',
      search: 'x',
    });
    expect(buildExportUrl(state)).toBe(
      '/api/products/export?sort=material&order=desc&brandId=1&search=x',
    );
  });
});
