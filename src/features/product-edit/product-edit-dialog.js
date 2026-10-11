import { el } from '../../shared/lib/dom.js';
import { closeDialog, openDialog } from '../../shared/ui/dialog.js';
import { ApiError, getJson } from '../../shared/api/http.js';
import { fetchProduct, updateProduct } from '../../entities/product/index.js';
import { translateErrorKey } from '../../shared/lib/error-messages.js';
import {
  createProductForm,
  GENERIC_FORM_ERROR,
  mapFieldErrors,
  populateEditSelects,
  validateClient,
} from './product-form.js';

/**
 * @typedef {import('../../entities/product/api.js').Product} Product
 * @typedef {import('../../entities/product/brand.js').Lookup} Lookup
 */

/**
 * @typedef {Object} EditDialogOptions
 * @property {() => Promise<{ brands: Lookup[], materials: Lookup[] }>} getLookups
 * @property {() => void} onSaved            called after a successful save
 * @property {() => void} onNotFound         called on 404 (list refresh)
 */

/**
 * Create the edit <dialog> controller.
 *
 * @param {EditDialogOptions} options
 * @returns {{ element: HTMLDialogElement, open: (product: Product, trigger?: HTMLElement | null) => void, close: () => void }}
 */
export function createProductEditDialog({ getLookups, onSaved, onNotFound }) {
  const dialog = el('dialog', {
    class: 'dialog',
    id: 'edit-dialog',
    'aria-labelledby': 'edit-dialog-title',
  });

  const form = createProductForm();

  const title = el('h2', { id: 'edit-dialog-title', text: 'Upravit produkt' });
  const closeButton = el(
    'button',
    { type: 'button', class: 'dialog__close', 'aria-label': 'Zavřít dialog' },
    ['✕'],
  );
  const submitButton = el('button', {
    type: 'submit',
    class: 'button button--primary',
    text: 'Uložit',
  });
  const cancelButton = el('button', {
    type: 'button',
    class: 'button button--ghost',
    text: 'Zrušit',
  });

  form.element.append(el('div', { class: 'dialog__actions' }, [cancelButton, submitButton]));

  dialog.append(
    el('div', { class: 'dialog__header' }, [title, closeButton]),
    el('div', { class: 'dialog__body' }, [form.element]),
  );

  /** @type {Product | null} */
  let currentProduct = null;
  /** @type {AbortController | null} */
  let controller = null;
  let submitting = false;

  closeButton.addEventListener('click', () => closeDialog(dialog));
  cancelButton.addEventListener('click', () => closeDialog(dialog));

  // Native <dialog> fires 'cancel' on Escape; make sure in-flight requests stop.
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeDialog(dialog);
  });

  form.element.addEventListener('submit', (event) => {
    event.preventDefault();
    void submit();
  });

  /**
   * @param {Product} product
   * @param {HTMLElement | null} [trigger]
   */
  function open(product, trigger = null) {
    currentProduct = product;
    form.reset();
    form.setFormError(null);
    setBusy(false);
    openDialog(dialog, trigger);

    // Immediately prefill from the already-known row, then confirm with GET.
    form.fill(product);
    void loadAndFill(product);
  }

  /**
   * Fetch the fresh detail and lookups, then fill the form.
   * @param {Product} product
   */
  async function loadAndFill(product) {
    controller?.abort();
    controller = new AbortController();
    setBusy(true);
    try {
      const [fresh, lookups] = await Promise.all([
        fetchProduct(product.id, controller.signal),
        getLookups(),
      ]);

      populateEditSelects(
        form.element,
        lookups.brands,
        lookups.materials,
        fresh.brandId,
        fresh.materialId,
      );
      form.fill(fresh);
      currentProduct = fresh;
    } catch (error) {
      if (isAbort(error)) {
        return;
      }
      // If the product vanished, tell the page to refresh and close the dialog.
      if (error instanceof ApiError && error.status === 404) {
        onNotFound();
        closeDialog(dialog);
        return;
      }
      form.setFormError(translateErrorKey(errorKeyOf(error)));
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (submitting || !currentProduct) {
      return;
    }

    const values = form.readValues();

    // Client-side mirror of the API rules; the API is still authoritative.
    const clientErrors = validateClient(values);
    if (Object.keys(clientErrors).length > 0) {
      form.setFieldErrors(clientErrors);
      return;
    }

    form.setFormError(null);
    setBusy(true);
    submitting = true;

    controller?.abort();
    controller = new AbortController();

    try {
      const payload = {
        code: values.code.trim(),
        name: values.name.trim(),
        description: values.description.trim() === '' ? null : values.description,
        price: values.price.trim(),
        brandId: Number(values.brandId),
        materialId: Number(values.materialId),
      };

      await updateProduct(currentProduct.id, payload, controller.signal);

      onSaved();
      closeDialog(dialog);
    } catch (error) {
      if (isAbort(error)) {
        return;
      }
      handleSubmitError(error);
    } finally {
      submitting = false;
      setBusy(false);
    }
  }

  /** @param {unknown} error */
  function handleSubmitError(error) {
    if (error instanceof ApiError && error.validation) {
      const { byField, formLevel } = mapFieldErrors(error.validation.fields);
      form.setFieldErrors(byField);
      if (formLevel.length > 0 && Object.keys(byField).length === 0) {
        form.setFormError(formLevel.join(' '));
      } else if (Object.keys(byField).length === 0) {
        form.setFormError(GENERIC_FORM_ERROR);
      }
      return;
    }

    if (error instanceof ApiError && (error.status === 404 || error.errorKey === 'notFound')) {
      form.setFormError('Produkt už neexistuje. Seznam bude obnoven.');
      onNotFound();
      return;
    }

    form.setFormError(translateErrorKey(errorKeyOf(error)));
  }

  /** @param {boolean} busy */
  function setBusy(busy) {
    submitButton.disabled = busy;
    submitButton.textContent = busy ? 'Ukládám…' : 'Uložit';
    form.element.setAttribute('aria-busy', busy ? 'true' : 'false');
  }

  return {
    element: dialog,
    open,
    close: () => closeDialog(dialog),
  };
}

/** @param {unknown} error */
function isAbort(error) {
  return error instanceof ApiError && error.errorKey === 'aborted';
}

/** @param {unknown} error */
function errorKeyOf(error) {
  return error instanceof ApiError ? error.errorKey : 'unknown';
}

// Re-export so the page can prefetch lookups with the same helper if needed.
export { getJson };
