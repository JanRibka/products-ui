/**
 * Thin helpers around the native <dialog> element.
 *
 * We use the platform's own focus trap, backdrop and Escape handling
 * (showModal/close) instead of re-implementing them.
 */

/**
 * Open a dialog modally (idempotent) and remember the trigger for focus return.
 * @param {HTMLDialogElement} dialog
 * @param {HTMLElement | null} [trigger]
 */
export function openDialog(dialog, trigger = null) {
  dialog.dataset.returnFocusId = trigger?.id ?? '';
  if (!dialog.open) {
    dialog.showModal();
  }
}

/**
 * Close a dialog if open.
 * @param {HTMLDialogElement} dialog
 */
export function closeDialog(dialog) {
  if (dialog.open) {
    dialog.close();
  }
}
