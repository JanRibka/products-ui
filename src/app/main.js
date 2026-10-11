import { mountProductsPage } from '../pages/products/index.js';

/**
 * Application bootstrap.
 *
 * A global handler translates any unexpected error into a friendly message;
 * raw API errors and stack traces are never shown.
 */
function bootstrap() {
  const root = document.querySelector('[data-products-root]');

  if (!(root instanceof HTMLElement)) {
    return;
  }

  mountProductsPage(root);
}

window.addEventListener('error', (event) => {
  // Never surface raw errors to the user.
  event.preventDefault();
  renderFatalError();
});

window.addEventListener('unhandledrejection', (event) => {
  event.preventDefault();
  renderFatalError();
});

function renderFatalError() {
  const root = document.querySelector('[data-products-root]');
  if (!(root instanceof HTMLElement) || root.dataset.fatal === 'true') {
    return;
  }
  root.dataset.fatal = 'true';
  root.textContent = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'error-region';

  const message = document.createElement('p');
  message.className = 'error-region__message';
  message.textContent = 'Nastala neočekávaná chyba. Obnovte prosím stránku.';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'button button--primary';
  button.textContent = 'Obnovit stránku';
  button.addEventListener('click', () => window.location.reload());

  wrapper.append(message, button);
  root.append(wrapper);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
} else {
  bootstrap();
}
