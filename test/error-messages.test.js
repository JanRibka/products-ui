import { describe, expect, it } from 'vitest';
import {
  GENERIC_ERROR_MESSAGE,
  GENERIC_VALIDATION_MESSAGE,
  translateErrorKey,
  translateValidationKey,
} from '../src/shared/lib/error-messages.js';

describe('error-messages – validation dictionary', () => {
  it('translates known keys to Czech', () => {
    expect(translateValidationKey('required')).toBe('Toto pole je povinné.');
    expect(translateValidationKey('code.unique')).toContain('kódem');
    expect(translateValidationKey('price.invalid')).toContain('Cena');
  });

  it('falls back to a generic message for unknown keys', () => {
    expect(translateValidationKey('totally.unknown')).toBe(GENERIC_VALIDATION_MESSAGE);
  });
});

describe('error-messages – generic dictionary', () => {
  it('translates known API error keys', () => {
    expect(translateErrorKey('notFound')).toContain('nalezen');
    expect(translateErrorKey('serverError')).toContain('serveru');
  });

  it('falls back to a generic message for unknown keys', () => {
    expect(translateErrorKey('weirdKey')).toBe(GENERIC_ERROR_MESSAGE);
  });
});
