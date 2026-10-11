import { describe, expect, it } from 'vitest';
import { formatPrice, truncate } from '../src/entities/product/format.js';

describe('format.js – formatPrice', () => {
  it('formats a string price as Czech currency', () => {
    const formatted = formatPrice('1890.00');
    // Intl in Node may emit a non-breaking space; normalize it for comparison.
    expect(formatted.replace(/\u00a0/g, ' ')).toBe('1 890,00 Kč');
  });

  it('formats thousands with a space separator', () => {
    const formatted = formatPrice('12345.50').replace(/\u00a0/g, ' ');
    expect(formatted).toBe('12 345,50 Kč');
  });

  it('formats the API string with a decimal point correctly', () => {
    const formatted = formatPrice('2450.50').replace(/\u00a0/g, ' ');
    expect(formatted).toBe('2 450,50 Kč');
  });

  it('falls back gracefully for empty / non-numeric values', () => {
    expect(formatPrice(null)).toBe('—');
    expect(formatPrice(undefined)).toBe('—');
    expect(formatPrice('')).toBe('—');
    expect(formatPrice('abc')).toBe('abc Kč');
  });
});

describe('format.js – truncate', () => {
  it('returns short strings unchanged', () => {
    expect(truncate('krátký', 20)).toBe('krátký');
  });

  it('adds an ellipsis when over the limit', () => {
    const result = truncate('abcdefghij', 5);
    expect(result.length).toBeLessThanOrEqual(5);
    expect(result.endsWith('…')).toBe(true);
  });

  it('handles null', () => {
    expect(truncate(null, 5)).toBe('');
  });
});
