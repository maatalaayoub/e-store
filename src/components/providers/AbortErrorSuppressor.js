"use client";

/**
 * Globally suppresses benign AbortErrors from showing in the dev error overlay.
 *
 * Why this exists:
 * - React Strict Mode double-mounts effects in dev, which causes in-flight
 *   fetches (in our code AND inside libraries like Supabase) to be aborted.
 * - Next.js 16's dev overlay catches every `unhandledrejection`, including these
 *   benign aborts, even when the calling code already handles them.
 *
 * This module registers the listener at MODULE LOAD time (not inside useEffect)
 * so it's active before any other client code runs. Real errors are unaffected.
 */

if (typeof window !== "undefined" && !window.__abortSuppressorInstalled) {
  window.__abortSuppressorInstalled = true;

  const isAbort = (reason) => {
    if (!reason) return false;
    if (reason.name === "AbortError") return true;
    if (reason.code === 20 || reason.code === "ABORT_ERR") return true; // DOMException ABORT_ERR
    if (typeof reason === "string" && /abort/i.test(reason)) return true;
    if (typeof reason.message === "string" && /abort|signal is aborted/i.test(reason.message)) return true;
    if (reason.cause && isAbort(reason.cause)) return true;
    return false;
  };

  window.addEventListener("unhandledrejection", (e) => {
    if (isAbort(e.reason)) {
      e.preventDefault();
      e.stopImmediatePropagation?.();
    }
  }, true);

  window.addEventListener("error", (e) => {
    if (isAbort(e.error) || isAbort(e.message)) {
      e.preventDefault();
      e.stopImmediatePropagation?.();
    }
  }, true);

  // Patch console.error to swallow abort messages too — Next.js dev overlay
  // hooks console.error to surface errors in some cases.
  const origConsoleError = console.error;
  console.error = function (...args) {
    for (const a of args) {
      if (isAbort(a)) return;
      if (typeof a === "string" && /signal is aborted|aborterror|abortsignal/i.test(a)) return;
    }
    return origConsoleError.apply(this, args);
  };
}

export default function AbortErrorSuppressor() {
  return null;
}
