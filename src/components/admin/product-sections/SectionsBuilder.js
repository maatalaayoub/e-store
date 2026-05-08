"use client";

/**
 * SectionsBuilder — drag-and-drop section list editor.
 *
 * Used by:
 *   1. Admin > Store Settings > Product Sections (global defaults) — pass context="global"
 *   2. Admin > Products > Edit modal (per-product overrides)        — context="product" (default)
 *
 * Pure client-side state container. Persistence is the parent's job —
 * it passes `value` + `onChange(nextSections)`.
 *
 * Drag-and-drop uses native HTML5 (no external dep) — same philosophy as
 * the rest of the codebase, which avoids extra runtime weight.
 */

import { useMemo, useState } from "react";
import {
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  Sparkles,
  AlignLeft,
  Images,
  Truck,
  MessageSquareQuote,
  Star,
  List,
  HelpCircle,
  Type,
  LayoutPanelLeft,
  Video,
  Megaphone,
  PackageOpen,
  RotateCcw,
  ShoppingBag,
} from "lucide-react";
import {
  SECTION_REGISTRY,
  createSectionDescriptor,
  getBuiltInDefaults,
  getRegistryEntry,
} from "@/modules/product-sections/registry";
import { useDictionary } from "@/components/providers/LocaleProvider";
import ConfirmationDialog from "@/components/ui/ConfirmationDialog";
import SectionEditor from "./SectionEditor";

const TYPE_ICONS = {
  AlignLeft, Images, Truck, MessageSquareQuote, Star, List, HelpCircle, Type,
  LayoutPanelLeft, Video, Megaphone, PackageOpen, Sparkles, ShoppingBag,
};

function TypeIcon({ name, className }) {
  const C = TYPE_ICONS[name] ?? Sparkles;
  return <C className={className} />;
}

/**
 * @param {object} props
 * @param {Array}  props.value                         — current sections array
 * @param {(next: Array) => void} props.onChange
 * @param {string} [props.emptyText]
 * @param {"global"|"product"} [props.context]      — affects delete dialog wording
 * @param {(next: Array) => Promise<void>} [props.onDelete]  — if provided, called after delete confirmed; should persist to server
 */
export default function SectionsBuilder({ value, onChange, emptyText, context = "product", onDelete, onSave }) {
  const sections = Array.isArray(value) ? value : [];
  const [expandedId, setExpandedId] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [dragId, setDragId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);   // section to delete
  const [deleting, setDeleting] = useState(false);          // loading state for delete dialog
  const [resetConfirm, setResetConfirm] = useState(false);  // reset all dialog open
  const [resetSectionTarget, setResetSectionTarget] = useState(null); // per-section reset
  const [resetFlashId, setResetFlashId] = useState(null);             // flash after reset
  const [resetSectionSaving, setResetSectionSaving] = useState(false);
  const [resetSavingId, setResetSavingId] = useState(null);           // which row icon is spinning

  const dict = useDictionary();
  const t = dict?.admin?.sections_builder ?? {};

  const types = useMemo(
    () =>
      Object.entries(SECTION_REGISTRY).filter(([, entry]) => {
        // Hide product-only types (e.g. inline checkout) from the global builder.
        if (context === "global" && entry.per_product_only) return false;
        // Hide global-only types from per-product builder.
        if (context !== "global" && entry.global_only) return false;
        return true;
      }),
    [context],
  );

  function update(id, updater) {
    onChange(sections.map((s) => (s.id === id ? updater(s) : s)));
  }
  async function confirmRemove() {
    if (!deleteTarget) return;
    const next = sections.filter((s) => s.id !== deleteTarget.id);
    if (onDelete) {
      setDeleting(true);
      try {
        await onDelete(next);
        onChange(next);
        setDeleteTarget(null);
      } finally {
        setDeleting(false);
      }
    } else {
      onChange(next);
      setDeleteTarget(null);
    }
  }
  function add(type) {
    const next = createSectionDescriptor(type, { order: sections.length });
    onChange([...sections, next]);
    setExpandedId(next.id);
    setAddOpen(false);
  }
  function move(fromIdx, toIdx) {
    if (fromIdx === toIdx || toIdx < 0 || toIdx >= sections.length) return;
    const next = [...sections];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    onChange(next.map((s, i) => ({ ...s, order: i })));
  }
  function confirmReset() {
    onChange(getBuiltInDefaults());
    setResetConfirm(false);
  }
  async function confirmResetSection() {
    if (!resetSectionTarget) return;
    const entry = getRegistryEntry(resetSectionTarget.type);
    if (!entry) { setResetSectionTarget(null); return; }
    const { config, content } = entry.defaults();
    const id = resetSectionTarget.id;
    const next = sections.map((s) =>
      s.id === id ? { ...s, config, content, translations: null } : s
    );
    // Close dialog, start spinner on the row icon (all in one batch)
    setResetSectionTarget(null);
    setResetSavingId(id);
    onChange(next);
    if (onSave) {
      setResetSectionSaving(true);
      try {
        await onSave(next);
      } catch {
        // onSave handles its own error toasts
      } finally {
        setResetSectionSaving(false);
        setResetSavingId(null);
        // Flash green as success indicator after the save
        setResetFlashId(id);
        setTimeout(() => setResetFlashId(null), 1000);
      }
    } else {
      setResetSavingId(null);
      setResetFlashId(id);
      setTimeout(() => setResetFlashId(null), 1000);
    }
  }

  // ── HTML5 drag handlers ────────────────────────────────────────────────────
  // Prevent drag from starting when the user clicks a button or input inside the row.
  const onDragStart = (id) => (e) => {
    if (e.target.closest("button, input, select, textarea, a")) {
      e.preventDefault();
      return;
    }
    setDragId(id);
  };
  const onDragOver = (e) => e.preventDefault();
  const onDrop = (overId) => () => {
    if (!dragId || dragId === overId) return setDragId(null);
    const from = sections.findIndex((s) => s.id === dragId);
    const to = sections.findIndex((s) => s.id === overId);
    move(from, to);
    setDragId(null);
  };

  const sectionCount = sections.length === 1
    ? (t.section_count_one ?? "1 section")
    : (t.section_count_many ?? "{n} sections").replace("{n}", sections.length);

  const deleteDesc = context === "global"
    ? (t.delete_desc_global ?? "This section will be removed from the default layout. All products using the default layout will no longer show it.")
    : (t.delete_desc_product ?? "This section will be removed from this product\u2019s page.");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <p className="text-sm text-zinc-500">{sectionCount}</p>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setAddOpen((v) => !v)}
              className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
            >
              <Plus className="h-3.5 w-3.5" /> {t.add_section ?? "Add section"}
              <ChevronDown className={`h-3 w-3 transition-transform ${addOpen ? "rotate-180" : ""}`} />
            </button>
            {addOpen && (
              <div className="absolute right-0 mt-1 z-30 w-72 max-h-80 overflow-y-auto rounded-xl border border-zinc-100 bg-white shadow-xl py-1.5">
                {types.map(([type, entry]) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => add(type)}
                    className="w-full flex items-start gap-3 px-3 py-2 text-start hover:bg-zinc-50"
                  >
                    <TypeIcon name={entry.icon} className="h-4 w-4 text-zinc-400 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-900">{entry.label}</p>
                      <p className="text-xs text-zinc-500 truncate">{entry.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {sections.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-200 p-8 text-center">
          <Sparkles className="mx-auto h-6 w-6 text-zinc-300" />
          <p className="mt-2 text-sm text-zinc-500">{emptyText ?? "No sections yet. Click \u201CAdd section\u201D to get started."}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {sections.map((section, idx) => {
            const entry = SECTION_REGISTRY[section.type];
            const isExpanded = expandedId === section.id;
            const isDragging = dragId === section.id;
            const isEnabled = section.enabled !== false;
            const isFlashing = resetFlashId === section.id;
            const isResetting = resetSavingId === section.id;
            // context="global"  → draggable row, no enable checkbox, no arrows, no delete
            // context="product" → draggable row, enable checkbox, arrows, no delete
            const isGlobal = context === "global";
            return (
              <li
                key={section.id}
                draggable={!isGlobal}
                onDragStart={!isGlobal ? onDragStart(section.id) : undefined}
                onDragOver={!isGlobal ? onDragOver : undefined}
                onDrop={!isGlobal ? onDrop(section.id) : undefined}
                onDragEnd={!isGlobal ? () => setDragId(null) : undefined}
                className={`rounded-xl border transition-all duration-700 ${isDragging ? "opacity-40" : "opacity-100"} ${
                  isFlashing
                    ? "bg-green-50 border-green-300 shadow-sm shadow-green-100"
                    : isExpanded
                      ? "bg-white border-blue-200 shadow-sm"
                      : "bg-white border-zinc-100"
                }`}
              >
                <div className="flex items-center gap-2 p-3">
                  {/* Drag handle — product context only */}
                  {!isGlobal && (
                    <span
                      className="cursor-grab text-zinc-300 hover:text-zinc-500 touch-none"
                      aria-label="Drag to reorder"
                    >
                      <GripVertical className="h-4 w-4" />
                    </span>
                  )}

                  {/* Enable / disable checkbox — product context only */}
                  {!isGlobal && (
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={() => update(section.id, (s) => ({ ...s, enabled: !s.enabled }))}
                      title={isEnabled ? (t.disable ?? "Disable section") : (t.enable ?? "Enable section")}
                      className="h-4 w-4 rounded accent-blue-600 shrink-0 cursor-pointer"
                    />
                  )}

                  <TypeIcon name={entry?.icon ?? "Sparkles"} className="h-4 w-4 text-zinc-500 shrink-0" />

                  {/* Section label — click to expand */}
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : section.id)}
                    className="flex-1 min-w-0 text-start"
                  >
                    <p className={`text-sm font-medium truncate ${isEnabled ? "text-zinc-900" : "text-zinc-400 line-through"}`}>
                      {entry?.label ?? section.type}
                      {section.content?.title
                        ? <span className="ms-2 font-normal text-zinc-400">— {section.content.title}</span>
                        : null}
                    </p>
                  </button>

                  {/* Up / down — product context only */}
                  {!isGlobal && (
                    <div className="hidden sm:flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => move(idx, idx - 1)}
                        disabled={idx === 0}
                        className="rounded-md p-1 text-zinc-400 hover:bg-zinc-50 disabled:opacity-30"
                      >▲</button>
                      <button
                        type="button"
                        onClick={() => move(idx, idx + 1)}
                        disabled={idx === sections.length - 1}
                        className="rounded-md p-1 text-zinc-400 hover:bg-zinc-50 disabled:opacity-30"
                      >▼</button>
                    </div>
                  )}

                  {/* Delete — global context only */}
                  {isGlobal && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(section); }}
                      className="rounded-md p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}

                  {/* Reset section to default */}
                  <button
                    type="button"
                    title="Reset section to default"
                    disabled={isResetting}
                    onClick={(e) => { e.stopPropagation(); setResetSectionTarget(section); }}
                    className="rounded-md p-1.5 text-zinc-400 hover:bg-amber-50 hover:text-amber-500 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <RotateCcw className={`h-4 w-4 ${isResetting ? 'animate-spin' : ''}`} />
                  </button>

                  {/* Expand toggle */}
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : section.id)}
                    className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-50"
                  >
                    <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                  </button>
                </div>

                {isExpanded && (
                  <div className="border-t border-zinc-100 p-4">
                    <SectionEditor
                      section={section}
                      onChange={(updater) => update(section.id, updater)}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Delete confirmation */}
      <ConfirmationDialog
        isOpen={deleteTarget !== null}
        title={t.delete_title ?? "Remove section?"}
        description={deleteDesc}
        confirmText={t.delete_confirm ?? "Remove"}
        cancelText={t.cancel ?? "Cancel"}
        isLoading={deleting}
        onConfirm={confirmRemove}
        onCancel={() => { if (!deleting) setDeleteTarget(null); }}
      />

      {/* Reset confirmation */}
      <ConfirmationDialog
        isOpen={resetConfirm}
        title={t.reset_confirm_title ?? "Reset layout?"}
        description={t.reset_confirm_desc ?? "This will replace all current sections with the built-in defaults."}
        confirmText={t.reset_confirm_btn ?? "Reset"}
        cancelText={t.cancel ?? "Cancel"}
        onConfirm={confirmReset}
        onCancel={() => setResetConfirm(false)}
      />

      {/* Per-section reset confirmation */}
      <ConfirmationDialog
        isOpen={resetSectionTarget !== null}
        title="Reset section to default?"
        description={`This will restore all settings and content of the "${SECTION_REGISTRY[resetSectionTarget?.type]?.label ?? resetSectionTarget?.type}" section back to its built-in defaults. Your customizations will be lost.`}
        confirmText="Reset section"
        cancelText={t.cancel ?? "Cancel"}
        onConfirm={confirmResetSection}
        onCancel={() => setResetSectionTarget(null)}
      />
    </div>
  );
}
