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
    if (typeof reason === "string" && /abort/i.test(reason)) return true;
    if (typeof reason.message === "string" && /aborted|abortcontroller/i.test(reason.message)) return true;
    return false;
  };

  window.addEventListener("unhandledrejection", (e) => {
    if (isAbort(e.reason)) e.preventDefault();
  });

  window.addEventListener("error", (e) => {
    if (isAbort(e.error) || isAbort(e.message)) e.preventDefault();
  });
}

export default function AbortErrorSuppressor() {
  return null;
}
