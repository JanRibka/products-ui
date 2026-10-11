import { el } from '../../shared/lib/dom.js';
import { fillSelect } from '../../shared/ui/select.js';
import { translateValidationKey } from '../../shared/lib/error-messages.js';

/**
 * @typedef {import('../../entities/product/api.js').Product} Product
 * @typedef {{ id: number, name: string }} Lookup
 */

/**
 * API validation field -> form control name. The API emits keys like
 * `code.unique`, `brand.notFound`, `materialId.invalidType`, `required`, etc.
 * Unknown fields are reported at the form level.
 *
 * @type {Record<string, string>}
 */
const FIELD_ALIASES = {
  code: 'code',
  name: 'name',
  description: 'description',
  price: 'price',
  brandId: 'brandId',
  brand: 'brandId',
  materialId: 'materialId',
  material: 'materialId',
};

export const GENERIC_FORM_ERROR = 'Zadané údaje nejsou platné. Zkontrolujte prosím formulář.';

/**
 * Map the API's field->key map to per-field Czech messages.
 *
 * @param {Record<string, string[]>} fields
 * @returns {{ byField: Record<string, string>, formLevel: string[] }}
 */
export function mapFieldErrors(fields) {
  /** @type {Record<string, string[]>} */
  const grouped = {};
  /** @type {string[]} */
  const formLevel = [];

  for (const [rawField, keys] of Object.entries(fields)) {
    const mapped = FIELD_ALIASES[rawField];
    if (!mapped) {
      // Unknown field -> generic message, but keep the form usable.
      for (const key of keys) {
        formLevel.push(translateValidationKey(key));
      }
      continue;
    }

    const bucket = grouped[mapped] ?? (grouped[mapped] = []);
    for (const key of keys) {
      const message = translateValidationKey(key);
      if (!bucket.includes(message)) {
        bucket.push(message);
      }
    }
  }

  /** @type {Record<string, string>} */
  const byField = {};
  for (const [field, messages] of Object.entries(grouped)) {
    byField[field] = messages.join(' ');
  }

  return { byField, formLevel };
}

/**
 * Client-side mirrors of the API rules. Kept intentionally aligned with
 * `UpdateProductRequestValidator`, but the API stays authoritative.
 *
 * @param {Record<string, string>} values
 * @returns {Record<string, string>} field -> message (empty when valid)
 */
export function validateClient(values) {
  /** @type {Record<string, string>} */
  const errors = {};

  if (!values.code?.trim()) {
    errors.code = translateValidationKey('required');
  } else if (values.code.length > 20) {
    errors.code = translateValidationKey('code.tooLong');
  }

  if (!values.name?.trim()) {
    errors.name = translateValidationKey('required');
  } else if (values.name.length > 255) {
    errors.name = translateValidationKey('name.tooLong');
  }

  if (values.description && values.description.length > 5000) {
    errors.description = translateValidationKey('description.tooLong');
  }

  const price = (values.price ?? '').trim();
  if (price === '') {
    errors.price = translateValidationKey('required');
  } else if (!/^\d+(\.\d{1,2})?$/.test(price) || Number(price) <= 0) {
    errors.price = translateValidationKey('price.invalid');
  }

  if (!values.brandId) {
    errors.brandId = translateValidationKey('required');
  }
  if (!values.materialId) {
    errors.materialId = translateValidationKey('required');
  }

  return errors;
}

/**
 * @typedef {Object} ProductForm
 * @property {HTMLFormElement} element
 * @property {() => void} reset
 * @property {(product: Product) => void} fill
 * @property {() => Record<string, string>} readValues
 * @property {(errors: Record<string, string>) => void} setFieldErrors
 * @property {(message: string | null) => void} setFormError
 */

/**
 * Build the edit form (code, name, description, price, brand, material).
 * Error containers are created up front and linked via aria-describedby so
 * messages can be announced without rebuilding the DOM.
 *
 * @returns {ProductForm}
 */
export function createProductForm() {
  const form = el('form', { class: 'product-form', novalidate: '' });

  /** @type {Record<string, HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>} */
  const controls = {
    code: textInput('edit-code', 'code', { maxlength: 20, required: true }),
    name: textInput('edit-name', 'name', { maxlength: 255, required: true }),
    price: textInput('edit-price', 'price', { inputmode: 'decimal', required: true }),
    description: el('textarea', {
      id: 'edit-description',
      name: 'description',
      rows: 4,
      maxlength: 5000,
      class: 'input',
    }),
  };

  const brandSelect = el('select', {
    id: 'edit-brand',
    name: 'brandId',
    class: 'input',
    required: true,
  });
  const materialSelect = el('select', {
    id: 'edit-material',
    name: 'materialId',
    class: 'input',
    required: true,
  });
  controls.brandId = brandSelect;
  controls.materialId = materialSelect;

  const formLevelError = el('div', {
    class: 'form-error form-error--summary',
    role: 'alert',
    hidden: 'hidden',
    'aria-live': 'assertive',
  });

  // Declared before it is populated by field() below (avoids TDZ access).
  const errorNodes = /** @type {Record<string, HTMLElement>} */ ({});

  form.append(
    formLevelError,
    field('Kód', controls.code),
    field('Název', controls.name),
    field('Cena', controls.price),
    field('Značka', brandSelect),
    field('Materiál', materialSelect),
    field('Popis', controls.description),
  );

  return {
    element: form,
    fill(product) {
      this.reset();
      controls.code.value = product.code;
      controls.name.value = product.name;
      controls.price.value = product.price;
      controls.description.value = product.description ?? '';
      brandSelect.value = String(product.brandId);
      materialSelect.value = String(product.materialId);
    },
    reset() {
      this.setFormError(null);
      for (const name of Object.keys(controls)) {
        clearFieldError(name);
      }
      formLevelError.hidden = true;
      formLevelError.textContent = '';
    },
    readValues() {
      return {
        code: controls.code.value,
        name: controls.name.value,
        price: controls.price.value,
        description: controls.description.value,
        brandId: brandSelect.value,
        materialId: materialSelect.value,
      };
    },
    setFieldErrors(errors) {
      this.reset();
      let firstInvalid = null;
      for (const [name, message] of Object.entries(errors)) {
        const control = controls[name];
        if (!control) {
          this.setFormError(message);
          continue;
        }
        applyFieldError(name, control, message);
        if (firstInvalid === null) {
          firstInvalid = control;
        }
      }
      if (firstInvalid) {
        firstInvalid.focus();
      }
    },
    setFormError(message) {
      if (!message) {
        formLevelError.hidden = true;
        formLevelError.textContent = '';
        return;
      }
      formLevelError.hidden = false;
      formLevelError.textContent = message;
    },
  };

  // ---- helpers ----
  /**
   * @param {string} id
   * @param {string} name
   * @param {Record<string, string | number | boolean>} extra
   */
  function textInput(id, name, extra = {}) {
    return el('input', { id, name, type: 'text', class: 'input', ...extra });
  }

  /**
   * @param {string} label
   * @param {HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement} control
   */
  function field(label, control) {
    const errorId = `${control.id}-error`;
    control.setAttribute('aria-describedby', errorId);

    const errorNode = el('p', {
      id: errorId,
      class: 'field-error',
      role: 'alert',
      hidden: 'hidden',
    });
    errorNodes[control.name] = errorNode;

    return el('div', { class: 'filters__field' }, [
      el('label', { for: control.id, text: label }),
      control,
      errorNode,
    ]);
  }

  /**
   * @param {string} name
   * @param {{ setAttribute: (k: string, v: string) => void }} control
   * @param {string} message
   */
  function applyFieldError(name, control, message) {
    const node = errorNodes[name];
    if (node) {
      node.hidden = false;
      node.textContent = message;
    }
    control.setAttribute('aria-invalid', 'true');
  }

  /** @param {string} name */
  function clearFieldError(name) {
    const node = errorNodes[name];
    const control = controls[name];
    if (node) {
      node.hidden = true;
      node.textContent = '';
    }
    control?.removeAttribute('aria-invalid');
  }
}

/**
 * Fill the brand/material selects inside a form created by createProductForm.
 * @param {HTMLFormElement} form
 * @param {Lookup[]} brands
 * @param {Lookup[]} materials
 * @param {number} brandId
 * @param {number} materialId
 */
export function populateEditSelects(form, brands, materials, brandId, materialId) {
  const brandSelect = /** @type {HTMLSelectElement} */ (form.elements.namedItem('brandId'));
  const materialSelect = /** @type {HTMLSelectElement} */ (form.elements.namedItem('materialId'));

  fillSelect(brandSelect, brands, { placeholder: 'Vyberte značku' });
  fillSelect(materialSelect, materials, { placeholder: 'Vyberte materiál' });

  brandSelect.value = String(brandId);
  materialSelect.value = String(materialId);
}
