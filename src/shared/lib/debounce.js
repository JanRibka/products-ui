/**
 * Trailing debounce. Returns a function with a `.cancel()` method so callers
 * (e.g. tests and teardown) can drop a pending invocation.
 *
 * @param {(...args: any[]) => void} fn
 * @param {number} delayMs
 * @returns {((...args: any[]) => void) & { cancel: () => void }}
 */
export function debounce(fn, delayMs) {
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timer;

  /** @type {((...args: any[]) => void) & { cancel: () => void }} */
  const wrapped = Object.assign(
    /** @param {...any} args */
    (...args) => {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        timer = undefined;
        fn(...args);
      }, delayMs);
    },
    {
      cancel: () => {
        if (timer !== undefined) {
          clearTimeout(timer);
          timer = undefined;
        }
      },
    },
  );

  return wrapped;
}
