import { clear, el } from '../lib/dom.js';

/**
 * Fill a <select> with options built safely (createElement + textContent).
 * An optional leading placeholder option is added first.
 *
 * @param {HTMLSelectElement} select
 * @param {{ id: number, name: string }[]} options
 * @param {Object} [config]
 * @param {string} [config.placeholder]  label for the empty/placeholder option
 */
export function fillSelect(select, options, { placeholder } = {}) {
  clear(select);

  if (placeholder !== undefined) {
    select.append(el('option', { value: '', text: placeholder }));
  }

  for (const option of options) {
    select.append(el('option', { value: String(option.id), text: option.name }));
  }
}
