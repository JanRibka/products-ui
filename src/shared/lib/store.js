/**
 * Minimal observable store: holds an immutable state value and notifies
 * subscribers on every `set`. No framework, no magic.
 *
 * @template S
 * @param {S} initialState
 */
export function createStore(initialState) {
  /** @type {S} */
  let state = initialState;
  /** @type {Set<(state: S) => void>} */
  const listeners = new Set();

  return {
    /** @returns {S} */
    get() {
      return state;
    },
    /**
     * @param {S | ((prev: S) => S)} next
     */
    set(next) {
      state = typeof next === 'function' ? /** @type {(prev: S) => S} */ (next)(state) : next;
      for (const listener of listeners) {
        listener(state);
      }
    },
    /**
     * @param {(state: S) => void} listener
     * @returns {() => void} unsubscribe
     */
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
