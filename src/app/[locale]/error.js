"use client";

import { useEffect } from "react";

/**
 * Top-level error boundary for every route under [locale].
 * Catches uncaught render/fetch errors in server and client components and
 * gives the user a way to recover without leaving the app.
 */
export default function Error({ error, reset }) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error("[route error]", error);
    }
  }, [error]);

  return (
    <div
      role="alert"
      className="min-h-[60vh] w-full flex flex-col items-center justify-center gap-4 px-6 text-center"
    >
      <h2 className="text-xl font-semibold text-zinc-900">Something went wrong</h2>
      <p className="text-sm text-zinc-500 max-w-md">
        An unexpected error occurred. You can try again, or come back later.
      </p>
      <div className="flex gap-3 mt-2">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-800 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
