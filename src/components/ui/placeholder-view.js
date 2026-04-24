/**
 * PlaceholderView
 *
 * Minimal structural placeholder rendered by every stub page.
 * Displays the route path so developers can orient themselves during setup.
 * Replace the contents of individual pages — do NOT modify this component.
 *
 * @param {{ route: string, label: string }} props
 */
export default function PlaceholderView({ route, label }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2">
      <p className="font-mono text-xs text-zinc-400">{route}</p>
      <p className="text-sm font-medium text-zinc-500">{label}</p>
    </div>
  );
}
