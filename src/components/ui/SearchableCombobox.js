"use client";

import { useMemo, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { useOnClickOutside } from "@/hooks/useOnClickOutside";

/**
 * Generic Searchable Combobox — used for Country & City selectors.
 *
 * @param items              string[] | { value, label }[]
 * @param value              currently selected value
 * @param onChange           (value: string) => void
 * @param placeholder        text shown when nothing selected
 * @param disabledMsg        text shown when items[] is empty
 * @param searchPlaceholder  search input placeholder
 * @param isRtl              right-to-left layout for option text
 */
export default function SearchableCombobox({
  items,
  value,
  onChange,
  placeholder,
  disabledMsg,
  searchPlaceholder,
  isRtl,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef(null);

  useOnClickOutside(ref, () => setOpen(false), open);

  const normalised = useMemo(
    () => items.map((i) => (typeof i === "string" ? { value: i, label: i } : i)),
    [items]
  );

  const filtered = useMemo(
    () =>
      normalised
        .filter((i) => i.label.toLowerCase().includes(search.toLowerCase()))
        .slice(0, 200),
    [normalised, search]
  );

  const selectedLabel = normalised.find((i) => i.value === value)?.label ?? "";

  const handleOpen = () => {
    setSearch("");
    setOpen((o) => !o);
  };

  const handleSelect = (val) => {
    onChange(val);
    setOpen(false);
    setSearch("");
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={handleOpen}
        disabled={items.length === 0}
        className="w-full flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50/50 px-3 py-2.5 text-sm outline-none focus:border-zinc-400 focus:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className={selectedLabel ? "text-zinc-900" : "text-zinc-400"}>
          {items.length === 0 ? disabledMsg : selectedLabel || placeholder}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-zinc-400 shrink-0 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-zinc-200 bg-white shadow-xl overflow-hidden">
          <div className="p-2 border-b border-zinc-100">
            <div className="flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-2.5 focus-within:border-zinc-400 transition-colors">
              <Search className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 py-1.5 text-sm outline-none bg-transparent placeholder:text-zinc-400"
                placeholder={searchPlaceholder ?? "Search..."}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="text-zinc-400 hover:text-zinc-600 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <ul className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2.5 text-sm text-zinc-400">No results found</li>
            ) : (
              filtered.map((item, idx) => (
                <li key={`${item.value}-${idx}`}>
                  <button
                    type="button"
                    className={`w-full ${
                      isRtl ? "text-right" : "text-left"
                    } px-3 py-2 text-sm transition-colors hover:bg-zinc-50 ${
                      item.value === value
                        ? "font-medium text-zinc-900 bg-zinc-50"
                        : "text-zinc-700"
                    }`}
                    onClick={() => handleSelect(item.value)}
                  >
                    {item.label}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
