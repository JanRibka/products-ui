import { afterEach, describe, expect, it } from 'vitest';
import {
  createProductForm,
  mapFieldErrors,
  validateClient,
} from '../src/features/product-edit/product-form.js';

afterEach(() => {
  document.body.replaceChildren();
});

describe('product-form – mapFieldErrors', () => {
  it('maps API fields to control names and translates keys', () => {
    const { byField, formLevel } = mapFieldErrors({
      code: ['code.unique'],
      price: ['price.invalid'],
      brand: ['brand.notFound'],
      materialId: ['material.notFound'],
      name: ['required'],
    });

    expect(byField).toEqual({
      code: 'Produkt s tímto kódem už existuje.',
      price: expect.stringContaining('Cena'),
      brandId: expect.stringContaining('značka'),
      materialId: expect.stringContaining('materiál'),
      name: 'Toto pole je povinné.',
    });
    expect(formLevel).toEqual([]);
  });

  it('routes unknown fields to a form-level generic message', () => {
    const { byField, formLevel } = mapFieldErrors({ wat: ['mystery.key'] });

    expect(byField).toEqual({});
    expect(formLevel).toHaveLength(1);
  });

  it('joins multiple keys for the same field with a space', () => {
    const { byField } = mapFieldErrors({ code: ['required', 'code.tooLong'] });
    expect(byField.code).toContain('povinné');
    expect(byField.code).toContain('20');
  });

  it('maps brandId/materialId variants to the same control', () => {
    expect(mapFieldErrors({ brandId: ['brandId.invalidType'] }).byField.brandId).toBeDefined();
    expect(mapFieldErrors({ brand: ['brand.notFound'] }).byField.brandId).toBeDefined();
  });
});

describe('product-form – validateClient', () => {
  /** @returns {Record<string, string>} */
  function validValues() {
    return {
      code: 'PM00001',
      name: 'Kryt pod motor',
      price: '1990.00',
      description: '',
      brandId: '1',
      materialId: '2',
    };
  }

  it('accepts valid values', () => {
    expect(validateClient(validValues())).toEqual({});
  });

  it('requires code, name, price and lookups', () => {
    const errors = validateClient({ code: '', name: '', price: '', brandId: '', materialId: '' });
    expect(Object.keys(errors).sort()).toEqual(['brandId', 'code', 'materialId', 'name', 'price']);
  });

  it('rejects a non-positive or over-precise price', () => {
    expect(validateClient({ ...validValues(), price: '0' }).price).toBeDefined();
    expect(validateClient({ ...validValues(), price: '-5' }).price).toBeDefined();
    expect(validateClient({ ...validValues(), price: '10.999' }).price).toBeDefined();
    expect(validateClient({ ...validValues(), price: '10.99' }).price).toBeUndefined();
  });

  it('rejects an over-long code / name / description', () => {
    expect(validateClient({ ...validValues(), code: 'x'.repeat(21) }).code).toBeDefined();
    expect(validateClient({ ...validValues(), name: 'x'.repeat(256) }).name).toBeDefined();
    expect(
      validateClient({ ...validValues(), description: 'x'.repeat(5001) }).description,
    ).toBeDefined();
  });
});

describe('product-form – rendering & 422 application', () => {
  it('builds controls with aria wiring and applies field errors', () => {
    const form = createProductForm();
    document.body.append(form.element);

    form.fill({
      id: 1,
      code: 'PM00001',
      name: 'Kryt pod motor',
      description: 'Popis',
      price: '1990.00',
      brandId: 1,
      brandName: 'Audi',
      materialId: 2,
      materialName: 'Plech',
      createdAt: '',
      updatedAt: '',
    });

    expect(/** @type {HTMLInputElement} */ (form.element.elements.namedItem('code')).value).toBe(
      'PM00001',
    );

    form.setFieldErrors({ code: 'Kód je špatně.', price: 'Cena je špatně.' });

    const codeInput = /** @type {HTMLInputElement} */ (form.element.elements.namedItem('code'));
    expect(codeInput.getAttribute('aria-invalid')).toBe('true');
    const codeError = form.element.querySelector('#edit-code-error');
    expect(codeError?.textContent).toBe('Kód je špatně.');
    expect(codeError?.hasAttribute('hidden')).toBe(false);
  });

  it('never injects hostile values as HTML', () => {
    const form = createProductForm();
    document.body.append(form.element);

    const hostile = '<img src=x onerror=alert(1)>';
    form.setFieldErrors({ code: hostile });

    expect(document.querySelector('img')).toBeNull();
    expect(form.element.querySelector('#edit-code-error')?.textContent).toBe(hostile);
  });

  it('resets errors and message on reset', () => {
    const form = createProductForm();
    document.body.append(form.element);

    form.setFieldErrors({ code: 'chyba' });
    form.setFormError('souhrn');
    form.reset();

    expect(form.element.querySelector('#edit-code-error')?.hasAttribute('hidden')).toBe(true);
    const summary = form.element.querySelector('.form-error--summary');
    expect(summary?.hasAttribute('hidden')).toBe(true);
  });
});
