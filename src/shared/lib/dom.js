/**
 * Small, safe DOM helpers.
 *
 * Everything here builds nodes with `document.createElement` + `textContent`
 * (never innerHTML) so untrusted API data can never be interpreted as markup.
 */

/**
 * @template {keyof HTMLElementTagNameMap} K
 * @param {K} tag
 * @param {Record<string, string | number | boolean | null | undefined>} [attrs]
 * @param {(Node | string)[]} [children]
 * @returns {HTMLElementTagNameMap[K]}
 */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);

  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) {
      continue;
    }

    if (key === 'text') {
      node.textContent = String(value);
    } else if (key === 'class') {
      node.className = String(value);
    } else if (key === 'dataset') {
      // Not used via attrs; kept out to avoid accidental key injection.
    } else if (value === true) {
      node.setAttribute(key, '');
    } else {
      node.setAttribute(key, String(value));
    }
  }

  for (const child of children) {
    node.append(child);
  }

  return node;
}

/**
 * Remove all children of a node without using innerHTML.
 * @param {Node} node
 */
export function clear(node) {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}
