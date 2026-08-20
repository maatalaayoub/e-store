"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { createPortal } from "react-dom";
import { PREDEFINED_COLORS, findColorByHex } from "@/config/colors";

/**
 * ColorPicker — admin UI for selecting multiple predefined colors.
 *
 * Props
 *   value      [{ name, hex }]  selected colors (server format, English name)
 *   onChange   fn([{ name, hex }])
 *   t          translation object (admin.products.form)
 *   locale     current UI locale — used to show translated color names
 */
export default function ColorPicker({ value = [], onChange, t = {}, locale = "en" }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  // coords drives fixed-panel position; bottom!=null means panel flipped above trigger
  const [coords, setCoords] = useState({ top: 0, bottom: null, left: 0, width: 320, maxGridH: 288 });
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const searchRef = useRef(null);

  // ── positioning ────────────────────────────────────────────────────
  // ~84px accounts for search bar + footer; panel always stays within viewport
  const PANEL_OVERHEAD = 84;
  const MIN_GRID_H = 140;

  function computeCoords() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const vh = window.innerHeight;
    const panelWidth = Math.max(rect.width, 320);
    const spaceBelow = vh - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    if (spaceBelow >= MIN_GRID_H + PANEL_OVERHEAD || spaceBelow >= spaceAbove) {
      return {
        top: rect.bottom + 4, bottom: null, left: rect.left, width: panelWidth,
        maxGridH: Math.min(Math.max(spaceBelow - PANEL_OVERHEAD, MIN_GRID_H), 400),
      };
    }
    // Flip above when more space there
    return {
      top: null, bottom: vh - rect.top + 4, left: rect.left, width: panelWidth,
      maxGridH: Math.min(Math.max(spaceAbove - PANEL_OVERHEAD, MIN_GRID_H), 400),
    };
  }

  // ── open / close ──────────────────────────────────────────────────
  function openPanel() {
    const c = computeCoords();
    if (c) setCoords(c);
    setOpen((v) => !v);
  }

  useEffect(() => {
    if (!open) { setQuery(""); return; }
    const id = setTimeout(() => searchRef.current?.focus(), 50);
    return () => clearTimeout(id);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target) &&
        panelRef.current && !panelRef.current.contains(e.target)
      ) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on outside click

  // Reposition on scroll / resize while open
  useEffect(() => {
    if (!open) return;
    const reposition = () => {
      const c = computeCoords();
      if (!c) { setOpen(false); return; }
      setCoords(c);
    };
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ── helpers ───────────────────────────────────────────────────────────────
  // Deduplicate by hex to guard against legacy data with duplicate entries.
  const dedupedValue = value.filter(
    (c, idx, arr) => arr.findIndex((x) => x.hex.toUpperCase() === c.hex.toUpperCase()) === idx,
  );
  const selectedHexes = new Set(dedupedValue.map((c) => c.hex.toUpperCase()));

  // Resolve localized display name for a stored { name, hex } entry.
  function resolveDisplayName(c) {
    const predefined = findColorByHex(c.hex);
    return predefined?.translations?.[locale] ?? predefined?.name ?? c.name;
  }

  // Display label for a predefined palette entry.
  function colorLabel(color) {
    return color.translations?.[locale] ?? color.name;
  }

  function isSelected(color) {
    return selectedHexes.has(color.hex.toUpperCase());
  }

  function toggleColor(color) {
    if (isSelected(color)) {
      onChange(value.filter((c) => c.hex.toUpperCase() !== color.hex.toUpperCase()));
    } else {
      // Always persist the canonical English name; locale is display-only.
      onChange([...value, { name: color.name, hex: color.hex }]);
    }
  }

  function removeColor(hex) {
    onChange(value.filter((c) => c.hex.toUpperCase() !== hex.toUpperCase()));
  }

  const filtered = query.trim()
    ? PREDEFINED_COLORS.filter((c) => {
        const q = query.trim().toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          (c.translations?.[locale] ?? "").toLowerCase().includes(q)
        );
      })
    : PREDEFINED_COLORS;

  // Light colors need a border so they don't vanish on a white background.
  function needsBorder(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return (r + g + b) / 3 > 220;
  }

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-2">
      {/* Selected color tags */}
      {dedupedValue.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {dedupedValue.map((c) => (
            <span
              key={c.hex}
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-700"
            >
              <span
                className={`h-3.5 w-3.5 rounded-full shrink-0 ${needsBorder(c.hex) ? "border border-zinc-300" : ""}`}
                style={{ backgroundColor: c.hex }}
              />
              {resolveDisplayName(c)}
              <button
                type="button"
                onClick={() => removeColor(c.hex)}
                aria-label={`Remove ${c.name}`}
                className="rounded-full text-zinc-400 hover:text-red-500 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Trigger button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={openPanel}
        className="flex w-full items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-start hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
      >
        {dedupedValue.length > 0 ? (
          <span className="flex items-center gap-1 flex-wrap flex-1">
            {dedupedValue.slice(0, 5).map((c) => (
              <span
                key={c.hex}
                title={resolveDisplayName(c)}
                className={`h-4 w-4 rounded-full shrink-0 ${needsBorder(c.hex) ? "border border-zinc-300" : ""}`}
                style={{ backgroundColor: c.hex }}
              />
            ))}
            {dedupedValue.length > 5 && (
              <span className="text-xs text-zinc-500">+{dedupedValue.length - 5}</span>
            )}
          </span>
        ) : (
          <span className="flex-1 text-zinc-400">
            {t.color_picker_placeholder ?? "Select colors…"}
          </span>
        )}
        <ChevronDown
          className={`h-4 w-4 text-zinc-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Floating panel — portalled to body so it escapes modal overflow clipping */}
      {open && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            style={{
              position: "fixed",
              top: coords.top ?? undefined,
              bottom: coords.bottom ?? undefined,
              left: coords.left,
              width: coords.width,
              zIndex: 9999,
            }}
            className="rounded-xl border border-zinc-100 bg-white shadow-xl overflow-hidden flex flex-col"
          >
            {/* Search bar */}
            <div className="flex items-center gap-2 border-b border-zinc-100 px-3 py-2 shrink-0">
              <Search className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.color_search_placeholder ?? "Search color…"}
                className="flex-1 bg-transparent text-sm text-zinc-700 placeholder-zinc-400 focus:outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="text-zinc-400 hover:text-zinc-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Scrollable color grid */}
            <div
              className="overflow-y-auto p-2"
              style={{ maxHeight: coords.maxGridH }}
            >
              {filtered.length === 0 ? (
                <p className="py-6 text-center text-sm text-zinc-400">
                  {t.color_no_results ?? "No colors match your search."}
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                  {filtered.map((color) => {
                    const sel = isSelected(color);
                    return (
                      <button
                        key={color.id}
                        type="button"
                        onClick={() => toggleColor(color)}
                        className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-all text-start ${
                          sel
                            ? "bg-blue-50 ring-1 ring-blue-400"
                            : "hover:bg-zinc-50"
                        }`}
                      >
                        {/* Swatch */}
                        <span className="relative shrink-0">
                          <span
                            className={`flex h-6 w-6 rounded-full ${needsBorder(color.hex) ? "border border-zinc-300" : ""}`}
                            style={{ backgroundColor: color.hex }}
                          />
                          {sel && (
                            <Check
                              className="absolute inset-0 m-auto h-3.5 w-3.5"
                              style={{ color: needsBorder(color.hex) ? "#374151" : "#ffffff" }}
                              strokeWidth={3}
                            />
                          )}
                        </span>
                        <span className={`truncate text-xs font-medium ${sel ? "text-blue-700" : "text-zinc-700"}`}>
                          {colorLabel(color)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            {dedupedValue.length > 0 && (
              <div className="border-t border-zinc-100 px-3 py-2 flex items-center justify-between shrink-0">
                <span className="text-xs text-zinc-500">
                  {dedupedValue.length} {t.color_selected ?? "selected"}
                </span>
                <button
                  type="button"
                  onClick={() => { onChange([]); setOpen(false); }}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  {t.color_clear_all ?? "Clear all"}
                </button>
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
