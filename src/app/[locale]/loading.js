/**
 * Top-level loading fallback for every route under [locale].
 * Renders a lightweight skeleton so users never see a blank screen
 * during navigation or server-component data fetches.
 */
export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading"
      className="min-h-[60vh] w-full flex flex-col items-center justify-center gap-4 px-6"
    >
      <div className="h-10 w-10 rounded-full border-4 border-zinc-200 border-t-zinc-900 animate-spin" />
      <div className="h-3 w-40 rounded bg-zinc-100 animate-pulse" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
