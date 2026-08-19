"use client";

import { useState } from "react";
import { Plus, Check } from "lucide-react";
import { RAM_OPTION_PRESETS, STORAGE_OPTION_PRESETS } from "@/config/product-types/attributes";
import { comboKey } from "@/lib/product-variants";

const EMPTY = { ram_enabled: false, storage_enabled: false, ram_options: [], storage_options: [], combos: [] };

const DIM_META = {
  ram: { presets: RAM_OPTION_PRESETS, optionsKey: "ram_options", enabledKey: "ram_enabled" },
  storage: { presets: STORAGE_OPTION_PRESETS, optionsKey: "storage_options", enabledKey: "storage_enabled" },
};

/** Rebuild the combo matrix from the enabled dimensions + their options,
 *  preserving previously-entered price/stock/sku/availability by combo key. */
function buildCombos(v) {
  const ramOn = v.ram_enabled;
  const storeOn = v.storage_enabled;
  if (!ramOn && !storeOn) return [];
  const rams = ramOn ? v.ram_options : [""];
  const stores = storeOn ? v.storage_options : [""];
  if (ramOn && rams.length === 0) return [];
  if (storeOn && stores.length === 0) return [];

  const prev = new Map((v.combos ?? []).map((c) => [comboKey(c, ramOn, storeOn), c]));
  const out = [];
  for (const r of rams) {
    for (const s of stores) {
      const base = { ...(ramOn ? { ram: r } : {}), ...(storeOn ? { storage: s } : {}) };
      const key = comboKey(base, ramOn, storeOn);
      const existing = prev.get(key);
      out.push(
        existing
          ? { ...base, additional_price: existing.additional_price, stock: existing.stock, sku: existing.sku, available: existing.available }
          : { ...base, additional_price: 0, stock: 0, sku: "", available: true },
      );
    }
  }
  return out;
}

export default function VariantBuilder({ dimensions, value, onChange, t }) {
  const v = value ?? EMPTY;
  const [customInput, setCustomInput] = useState({ ram: "", storage: "" });

  const commit = (next) => onChange({ ...next, combos: buildCombos(next) });

  const toggleDim = (dim, on) => {
    const meta = DIM_META[dim];
    commit({ ...v, [meta.enabledKey]: on });
  };

  const toggleOption = (dim, label) => {
    const meta = DIM_META[dim];
    const list = v[meta.optionsKey] ?? [];
    const exists = list.some((o) => o.toLowerCase() === label.toLowerCase());
    const next = exists ? list.filter((o) => o.toLowerCase() !== label.toLowerCase()) : [...list, label];
    commit({ ...v, [meta.optionsKey]: next });
  };

  const addCustom = (dim) => {
    const label = customInput[dim].trim();
    if (!label) return;
    const meta = DIM_META[dim];
    const list = v[meta.optionsKey] ?? [];
    if (!list.some((o) => o.toLowerCase() === label.toLowerCase())) {
      commit({ ...v, [meta.optionsKey]: [...list, label] });
    }
    setCustomInput((p) => ({ ...p, [dim]: "" }));
  };

  const setCombo = (idx, patch) => {
    const combos = v.combos.map((c, i) => (i === idx ? { ...c, ...patch } : c));
    onChange({ ...v, combos }); // no rebuild — editing a cell, not the matrix
  };

  const dimLabel = (dim) =>
    dim === "ram" ? (t.variants_ram ?? "RAM") : (t.variants_storage ?? "Storage");

  return (
    <div className="space-y-4">
      {dimensions.map((dim) => {
        const meta = DIM_META[dim];
        const enabled = v[meta.enabledKey];
        const selected = v[meta.optionsKey] ?? [];
        return (
          <div key={dim} className="rounded-lg border border-zinc-200 p-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => toggleDim(dim, e.target.checked)}
                className="h-4 w-4 rounded accent-blue-600"
              />
              <span className="text-sm font-medium text-zinc-800">
                {(t.variants_has ?? "This product has {dim} variants").replace("{dim}", dimLabel(dim))}
              </span>
            </label>

            {enabled && (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-zinc-500">{t.variants_pick_options ?? "Pick the available options:"}</p>
                <div className="flex flex-wrap gap-1.5">
                  {[...new Set([...meta.presets, ...selected])].map((opt) => {
                    const on = selected.some((o) => o.toLowerCase() === opt.toLowerCase());
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => toggleOption(dim, opt)}
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                          on
                            ? "border-blue-500 bg-blue-50 text-blue-700"
                            : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
                        }`}
                      >
                        {on && <Check className="h-3 w-3" strokeWidth={3} />}
                        {opt}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customInput[dim]}
                    onChange={(e) => setCustomInput((p) => ({ ...p, [dim]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); addCustom(dim); }
                    }}
                    placeholder={t.variants_custom_placeholder ?? "Add custom option…"}
                    className="flex-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => addCustom(dim)}
                    className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {t.variants_add ?? "Add"}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Combination matrix */}
      {v.combos.length > 0 && (
        <div className="rounded-lg border border-zinc-200 overflow-hidden">
          <div className="px-3 py-2 border-b border-zinc-100 bg-zinc-50">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {t.variants_combos ?? "Configurations"}
            </p>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              {t.variants_combos_hint ?? "Set an additional price, stock and SKU per configuration. Untick to hide a configuration from buyers."}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-400">
                  {v.ram_enabled && <th className="px-3 py-2 font-medium">{t.variants_ram ?? "RAM"}</th>}
                  {v.storage_enabled && <th className="px-3 py-2 font-medium">{t.variants_storage ?? "Storage"}</th>}
                  <th className="px-3 py-2 font-medium">{t.variants_additional_price ?? "Additional price"}</th>
                  <th className="px-3 py-2 font-medium">{t.stock_label ?? "Stock"}</th>
                  <th className="px-3 py-2 font-medium">{t.variants_sku ?? "SKU"}</th>
                  <th className="px-3 py-2 font-medium text-center">{t.variants_available ?? "Available"}</th>
                </tr>
              </thead>
              <tbody>
                {v.combos.map((c, idx) => (
                  <tr key={comboKey(c, v.ram_enabled, v.storage_enabled)} className="border-t border-zinc-100">
                    {v.ram_enabled && <td className="px-3 py-2 font-medium text-zinc-800 whitespace-nowrap">{c.ram}</td>}
                    {v.storage_enabled && <td className="px-3 py-2 font-medium text-zinc-800 whitespace-nowrap">{c.storage}</td>}
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <span className="text-zinc-400 text-xs">+</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={c.additional_price}
                          onChange={(e) => setCombo(idx, { additional_price: e.target.value })}
                          className="w-20 rounded-md border border-zinc-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={c.stock}
                        onChange={(e) => setCombo(idx, { stock: e.target.value })}
                        className="w-16 rounded-md border border-zinc-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={c.sku}
                        onChange={(e) => setCombo(idx, { sku: e.target.value })}
                        placeholder="—"
                        className="w-28 rounded-md border border-zinc-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={c.available !== false}
                        onChange={(e) => setCombo(idx, { available: e.target.checked })}
                        className="h-4 w-4 rounded accent-blue-600"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
