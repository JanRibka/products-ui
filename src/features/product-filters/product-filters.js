import { el } from '../../shared/lib/dom.js';
import { debounce } from '../../shared/lib/debounce.js';
import { fillSelect } from '../../shared/ui/select.js';

/**
 * @typedef {import('../../entities/product/query.js').ListState} ListState
 */

/**
 * @typedef {Object} ProductFiltersHandlers
 * @property {(patch: Partial<ListState>) => void} onChange
 * @property {() => void} onReset
 */

/**
 * Render the filter form. Brand/material selects are filled asynchronously by
 * the page (via `populateFilters`), so this returns the element plus a way to
 * fill the selects once the lookups arrive.
 *
 * Search is debounced; selects and price inputs update on change/blur.
 *
 * @param {ListState} state
 * @param {ProductFiltersHandlers} handlers
 * @returns {{ element: HTMLElement, populate: (brands: {id:number,name:string}[], materials: {id:number,name:string}[]) => void, setDisabled: (disabled: boolean) => void }}
 */
export function renderProductFilters(state, handlers) {
  const form = el('form', { class: 'filters', role: 'search', 'aria-label': 'Filtry produktů' });
  form.addEventListener('submit', (event) => event.preventDefault());

  // Brand
  const brandSelect = el('select', { id: 'filter-brand', name: 'brandId', class: 'input' });
  const brandField = field('Značka', brandSelect);

  // Material
  const materialSelect = el('select', {
    id: 'filter-material',
    name: 'materialId',
    class: 'input',
  });
  const materialField = field('Materiál', materialSelect);

  // Price from / to
  const priceFrom = el('input', {
    id: 'filter-price-from',
    name: 'priceFrom',
    type: 'text',
    inputmode: 'decimal',
    class: 'input',
    placeholder: 'např. 1000',
  });
  const priceTo = el('input', {
    id: 'filter-price-to',
    name: 'priceTo',
    type: 'text',
    inputmode: 'decimal',
    class: 'input',
    placeholder: 'např. 3000',
  });

  // Search (name + code only, per the API)
  const search = el('input', {
    id: 'filter-search',
    name: 'search',
    type: 'search',
    class: 'input',
    placeholder: 'Hledat v názvu a kódu…',
    'aria-describedby': 'filter-search-hint',
  });

  // Reset
  const reset = el('button', {
    type: 'button',
    class: 'button button--link',
    text: 'Zrušit filtry',
  });

  // Prefill from state.
  setValue(brandSelect, state.brandId === null ? '' : String(state.brandId));
  setValue(materialSelect, state.materialId === null ? '' : String(state.materialId));
  priceFrom.value = state.priceFrom ?? '';
  priceTo.value = state.priceTo ?? '';
  search.value = state.search;

  // Debounce the text inputs.
  const emitSearch = debounce((value) => handlers.onChange({ search: value.trim() }), 350);
  const emitPriceFrom = debounce(
    (value) => handlers.onChange({ priceFrom: normalize(value) }),
    500,
  );
  const emitPriceTo = debounce((value) => handlers.onChange({ priceTo: normalize(value) }), 500);

  search.addEventListener('input', () => emitSearch(search.value));
  priceFrom.addEventListener('change', () => emitPriceFrom(priceFrom.value));
  priceTo.addEventListener('change', () => emitPriceTo(priceTo.value));

  brandSelect.addEventListener('change', () =>
    handlers.onChange({ brandId: toIdOrNull(brandSelect.value) }),
  );
  materialSelect.addEventListener('change', () =>
    handlers.onChange({ materialId: toIdOrNull(materialSelect.value) }),
  );

  reset.addEventListener('click', () => {
    emitSearch.cancel();
    emitPriceFrom.cancel();
    emitPriceTo.cancel();
    handlers.onReset();
  });

  form.append(
    brandField,
    materialField,
    field('Cena od', priceFrom),
    field('Cena do', priceTo),
    fieldWithHint('Hledat', search, 'Hledá v názvu a kódu produktu.'),
    el('div', { class: 'filters__actions' }, [reset]),
  );

  return {
    element: form,
    populate(brands, materials) {
      fillSelect(brandSelect, brands, { placeholder: 'Všechny značky' });
      fillSelect(materialSelect, materials, { placeholder: 'Všechny materiály' });
      setValue(brandSelect, state.brandId === null ? '' : String(state.brandId));
      setValue(materialSelect, state.materialId === null ? '' : String(state.materialId));
    },
    setDisabled(disabled) {
      for (const control of form.querySelectorAll('select, input, button')) {
        /** @type {HTMLInputElement | HTMLSelectElement | HTMLButtonElement} */ (control).disabled =
          disabled;
      }
    },
  };

  // ---- helpers ----
  /** @param {string} label @param {HTMLElement} control */
  function field(label, control) {
    return el('div', { class: 'filters__field' }, [
      el('label', { for: /** @type {any} */ (control).id, text: label }),
      control,
    ]);
  }

  /** @param {string} label @param {HTMLElement} control @param {string} hint */
  function fieldWithHint(label, control, hint) {
    return el('div', { class: 'filters__field' }, [
      el('label', { for: /** @type {any} */ (control).id, text: label }),
      control,
      el('p', {
        id: `${/** @type {any} */ (control).id}-hint`,
        class: 'filters__hint',
        text: hint,
      }),
    ]);
  }
}

/** @param {HTMLSelectElement} select @param {string} value */
function setValue(select, value) {
  select.value = value;
}

/**
 * @param {string} value
 * @returns {number | null}
 */
function toIdOrNull(value) {
  return value === '' ? null : Number(value);
}

/**
 * @param {string} value
 * @returns {string | null}
 */
function normalize(value) {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}
