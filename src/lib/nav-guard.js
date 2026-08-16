// Minimal in-app navigation guard shared between the admin shell and any page
// that has unsaved changes. A page registers a handler; shell navigation calls
// `guardNavigation()` before leaving so the page can prompt first.

let handler = null;

/**
 * Register the active guard. Returns an unregister function.
 * @param {(proceed: () => void) => boolean} fn - receives the navigation to run;
 *   returns true if it intercepted (will run `proceed` later after confirming).
 */
export function registerNavGuard(fn) {
  handler = fn;
  return () => {
    if (handler === fn) handler = null;
  };
}

/**
 * Ask the active guard (if any) whether it wants to intercept a navigation.
 * @param {() => void} proceed - performs the navigation when allowed.
 * @returns {boolean} true if navigation was intercepted (a prompt was shown).
 */
export function guardNavigation(proceed) {
  if (handler) return handler(proceed) === true;
  return false;
}
