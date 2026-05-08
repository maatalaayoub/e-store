"use client";

/**
 * Per-section editor body.
 *
 * Receives the current section + an `onChange(updater)` setter and renders
 * the appropriate form for the section's type. The component dispatches
 * via a small switch, keeping each editor block self-contained.
 *
 * Translations: every section gets the same compact tab strip at the top
 * driven by `translatableFields`. When the active tab is the base locale
 * we edit `content` directly; otherwise we edit `translations[lang]`.
 */

import { useState } from "react";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { getRegistryEntry } from "@/modules/product-sections/registry";

const SUPPORTED_LANGS = ["en", "fr", "ar", "dr"];
const LANG_LABELS = { en: "EN", fr: "FR", ar: "AR", dr: "DR" };
const RTL = new Set(["ar", "dr"]);
const BASE_LANG = "en";

const inputClass =
  "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-blue-600";

function Field({ label, hint, children }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold text-zinc-700">{label}</label>
      {children}
      {hint && <p className="text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}

function Toggle({ label, value, onChange }) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer">
      <span className="text-sm text-zinc-700">{label}</span>
      <span
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${value ? "bg-blue-600" : "bg-zinc-300"}`}
      >
        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${value ? "translate-x-5" : "translate-x-1"}`} />
      </span>
    </label>
  );
}

function Select({ value, onChange, options }) {
  return (
    <select className={inputClass} value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// ── translation helpers ───────────────────────────────────────────────────────
function readField(section, lang, field) {
  if (lang === BASE_LANG) return section.content?.[field] ?? "";
  return section.translations?.[lang]?.[field] ?? "";
}

function writeField(section, lang, field, value) {
  if (lang === BASE_LANG) {
    return { ...section, content: { ...section.content, [field]: value } };
  }
  const nextLangBlock = { ...(section.translations?.[lang] ?? {}), [field]: value };
  return { ...section, translations: { ...(section.translations ?? {}), [lang]: nextLangBlock } };
}

// ── shared common-config block ───────────────────────────────────────────────
function CommonConfigBlock({ section, onChange }) {
  const cfg = section.config ?? {};
  const set = (k, v) => onChange((s) => ({ ...s, config: { ...s.config, [k]: v } }));
  return (
    <div className="grid grid-cols-2 gap-3 rounded-lg bg-zinc-50 p-3">
      <Field label="Background">
        <Select
          value={cfg.background ?? "transparent"}
          onChange={(v) => set("background", v)}
          options={[
            { value: "transparent", label: "Transparent" },
            { value: "muted", label: "Muted" },
            { value: "accent", label: "Accent" },
            { value: "custom", label: "Custom color" },
          ]}
        />
      </Field>
      {cfg.background === "custom" && (
        <Field label="Background color">
          <input
            type="color"
            className="w-full h-9 rounded-lg border border-zinc-200"
            value={cfg.background_color ?? "#ffffff"}
            onChange={(e) => set("background_color", e.target.value)}
          />
        </Field>
      )}
      <Field label="Width">
        <Select
          value={cfg.width ?? "container"}
          onChange={(v) => set("width", v)}
          options={[
            { value: "container", label: "Standard" },
            { value: "wide", label: "Wide" },
            { value: "full", label: "Full" },
          ]}
        />
      </Field>
      <Field label="Padding">
        <Select
          value={cfg.padding ?? "md"}
          onChange={(v) => set("padding", v)}
          options={[
            { value: "none", label: "None" },
            { value: "sm", label: "Small" },
            { value: "md", label: "Medium" },
            { value: "lg", label: "Large" },
          ]}
        />
      </Field>

      {/* ── Text color ── */}
      <Field label="Section title color">
        <div className="flex items-center gap-2">
          <input
            type="color"
            className="h-9 w-12 rounded-lg border border-zinc-200 cursor-pointer"
            value={cfg.title_color ?? "#111111"}
            onChange={(e) => set("title_color", e.target.value)}
          />
          <button
            type="button"
            onClick={() => set("title_color", null)}
            className="text-xs text-zinc-400 hover:text-zinc-700 underline"
          >
            Reset
          </button>
          {cfg.title_color && (
            <span className="text-xs font-mono text-zinc-500">{cfg.title_color}</span>
          )}
        </div>
      </Field>

      {/* ── Border ── */}
      <Field label="Border width (px)">
        <input
          type="number"
          min={0}
          max={20}
          className={inputClass}
          value={cfg.border_width ?? 0}
          onChange={(e) => set("border_width", Math.max(0, Math.min(20, Number.parseInt(e.target.value, 10) || 0)))}
        />
      </Field>
      <Field label="Border color">
        <div className="flex items-center gap-2">
          <input
            type="color"
            className="h-9 w-12 rounded-lg border border-zinc-200 cursor-pointer"
            value={cfg.border_color ?? "#e4e4e7"}
            onChange={(e) => set("border_color", e.target.value)}
          />
          {cfg.border_color && (
            <span className="text-xs font-mono text-zinc-500">{cfg.border_color}</span>
          )}
        </div>
      </Field>

      <div className="col-span-2">
        <Toggle label="Show section title" value={cfg.show_title !== false} onChange={(v) => set("show_title", v)} />
      </div>
    </div>
  );
}

// ── per-type editor blocks ───────────────────────────────────────────────────
function ItemsList({ items, onChange, columns }) {
  const setItem = (idx, patch) => {
    const next = items.map((it, i) => (i === idx ? { ...it, ...patch } : it));
    onChange(next);
  };
  const remove = (idx) => onChange(items.filter((_, i) => i !== idx));
  const add = () => onChange([...items, columns.reduce((a, c) => ({ ...a, [c.key]: "" }), {})]);
  return (
    <div className="space-y-2">
      {items.map((it, idx) => (
        <div key={idx} className="flex gap-2 items-start">
          <div className="flex-1 grid gap-2" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
            {columns.map((c) =>
              c.textarea ? (
                <textarea
                  key={c.key}
                  rows={2}
                  className={inputClass}
                  placeholder={c.label}
                  value={it[c.key] ?? ""}
                  onChange={(e) => setItem(idx, { [c.key]: e.target.value })}
                />
              ) : (
                <input
                  key={c.key}
                  className={inputClass}
                  placeholder={c.label}
                  value={it[c.key] ?? ""}
                  onChange={(e) => setItem(idx, { [c.key]: e.target.value })}
                />
              ),
            )}
          </div>
          <button
            type="button"
            onClick={() => remove(idx)}
            className="rounded-lg border border-zinc-200 p-2 text-zinc-400 hover:text-red-500 hover:border-red-200"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
      >
        <Plus className="h-3.5 w-3.5" /> Add item
      </button>
    </div>
  );
}

// ── main editor ──────────────────────────────────────────────────────────────
export default function SectionEditor({ section, onChange }) {
  const entry = getRegistryEntry(section.type);
  const translatableFields = entry?.translatableFields ?? [];
  const [lang, setLang] = useState(BASE_LANG);
  const isRTL = RTL.has(lang);

  if (!entry) return <p className="text-sm text-red-500">Unknown section type: {section.type}</p>;

  const setContent = (field, value) => onChange((s) => writeField(s, lang, field, value));
  const setConfig = (k, v) => onChange((s) => ({ ...s, config: { ...s.config, [k]: v } }));
  const setItems = (key) => (items) => onChange((s) => ({ ...s, content: { ...s.content, [key]: items } }));

  // Read with translation overlay for the active language so the editor
  // shows what will actually render in that locale.
  const get = (field) => readField(section, lang, field);

  const showTranslationTabs = translatableFields.length > 0;

  return (
    <div className="space-y-4">
      {showTranslationTabs && (
        <div className="flex gap-1 p-1 bg-zinc-100 rounded-lg">
          {SUPPORTED_LANGS.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              className={`flex-1 py-1 text-xs font-semibold rounded-md transition-all ${
                lang === l ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
              }`}
            >
              {LANG_LABELS[l]}
            </button>
          ))}
        </div>
      )}

      {/* Per-type body */}
      {section.type === "description" && (
        <Field label="Title">
          <input className={inputClass} dir={isRTL ? "rtl" : "ltr"} value={get("title")} onChange={(e) => setContent("title", e.target.value)} />
        </Field>
      )}

      {section.type === "ratings" && (
        <Field label="Title">
          <input className={inputClass} dir={isRTL ? "rtl" : "ltr"} value={get("title")} onChange={(e) => setContent("title", e.target.value)} />
        </Field>
      )}

      {section.type === "reviews" && (
        <>
          <Field label="Title">
            <input className={inputClass} dir={isRTL ? "rtl" : "ltr"} value={get("title")} onChange={(e) => setContent("title", e.target.value)} />
          </Field>
          <Field label="Empty state text">
            <input className={inputClass} dir={isRTL ? "rtl" : "ltr"} value={get("empty_text")} onChange={(e) => setContent("empty_text", e.target.value)} />
          </Field>
          <Field label="Limit">
            <input
              type="number"
              min={1}
              max={50}
              className={inputClass}
              value={section.config?.limit ?? 5}
              onChange={(e) => setConfig("limit", Number.parseInt(e.target.value, 10) || 5)}
            />
          </Field>
        </>
      )}

      {section.type === "gallery" && (
        <>
          <Field label="Title">
            <input className={inputClass} dir={isRTL ? "rtl" : "ltr"} value={get("title")} onChange={(e) => setContent("title", e.target.value)} />
          </Field>
          <Field label="Columns">
            <input
              type="number" min={1} max={6} className={inputClass}
              value={section.config?.columns ?? 3}
              onChange={(e) => setConfig("columns", Number.parseInt(e.target.value, 10) || 3)}
            />
          </Field>
          <Field label="Image URLs (one per line)">
            <textarea
              rows={4}
              className={inputClass}
              value={(section.content?.images ?? []).map((i) => i.url).join("\n")}
              onChange={(e) => {
                const urls = e.target.value.split("\n").map((u) => u.trim()).filter(Boolean);
                onChange((s) => ({ ...s, content: { ...s.content, images: urls.map((u) => ({ url: u, alt: "" })) } }));
              }}
            />
          </Field>
        </>
      )}

      {section.type === "specifications" && (
        <>
          <Field label="Title">
            <input className={inputClass} dir={isRTL ? "rtl" : "ltr"} value={get("title")} onChange={(e) => setContent("title", e.target.value)} />
          </Field>
          <Field label="Specifications">
            <ItemsList
              items={section.content?.items ?? []}
              onChange={setItems("items")}
              columns={[
                { key: "key", label: "Property" },
                { key: "value", label: "Value" },
              ]}
            />
          </Field>
        </>
      )}

      {section.type === "shipping" && (
        <>
          <Field label="Title">
            <input className={inputClass} dir={isRTL ? "rtl" : "ltr"} value={get("title")} onChange={(e) => setContent("title", e.target.value)} />
          </Field>
          <Field label="Items">
            <ItemsList
              items={section.content?.items ?? []}
              onChange={setItems("items")}
              columns={[
                { key: "icon", label: "Icon (Truck, Shield, …)" },
                { key: "title", label: "Title" },
                { key: "body", label: "Body", textarea: true },
              ]}
            />
          </Field>
        </>
      )}

      {section.type === "faq" && (
        <>
          <Field label="Title">
            <input className={inputClass} dir={isRTL ? "rtl" : "ltr"} value={get("title")} onChange={(e) => setContent("title", e.target.value)} />
          </Field>
          <Field label="Questions">
            <ItemsList
              items={section.content?.items ?? []}
              onChange={setItems("items")}
              columns={[
                { key: "question", label: "Question" },
                { key: "answer", label: "Answer", textarea: true },
              ]}
            />
          </Field>
        </>
      )}

      {section.type === "rich_text" && (
        <>
          <Field label="Title">
            <input className={inputClass} dir={isRTL ? "rtl" : "ltr"} value={get("title")} onChange={(e) => setContent("title", e.target.value)} />
          </Field>
          <Field label="Body">
            <textarea
              rows={5}
              dir={isRTL ? "rtl" : "ltr"}
              className={inputClass}
              value={get("body")}
              onChange={(e) => setContent("body", e.target.value)}
            />
          </Field>
          <Field label="Alignment">
            <Select
              value={section.config?.align ?? "start"}
              onChange={(v) => setConfig("align", v)}
              options={[
                { value: "start", label: "Start" },
                { value: "center", label: "Center" },
                { value: "end", label: "End" },
              ]}
            />
          </Field>
        </>
      )}

      {section.type === "image_text" && (
        <>
          <Field label="Title">
            <input className={inputClass} dir={isRTL ? "rtl" : "ltr"} value={get("title")} onChange={(e) => setContent("title", e.target.value)} />
          </Field>
          <Field label="Body">
            <textarea rows={4} dir={isRTL ? "rtl" : "ltr"} className={inputClass} value={get("body")} onChange={(e) => setContent("body", e.target.value)} />
          </Field>
          <Field label="Image URL">
            <input className={inputClass} value={section.content?.image_url ?? ""} onChange={(e) => onChange((s) => ({ ...s, content: { ...s.content, image_url: e.target.value } }))} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="CTA text">
              <input className={inputClass} dir={isRTL ? "rtl" : "ltr"} value={get("cta_text")} onChange={(e) => setContent("cta_text", e.target.value)} />
            </Field>
            <Field label="CTA href">
              <input className={inputClass} value={section.content?.cta_href ?? ""} onChange={(e) => onChange((s) => ({ ...s, content: { ...s.content, cta_href: e.target.value } }))} />
            </Field>
          </div>
          <Field label="Image position">
            <Select
              value={section.config?.image_position ?? "left"}
              onChange={(v) => setConfig("image_position", v)}
              options={[{ value: "left", label: "Left" }, { value: "right", label: "Right" }]}
            />
          </Field>
        </>
      )}

      {section.type === "video" && (
        <>
          <Field label="Title">
            <input className={inputClass} dir={isRTL ? "rtl" : "ltr"} value={get("title")} onChange={(e) => setContent("title", e.target.value)} />
          </Field>
          <Field label="Video URL" hint="YouTube / Vimeo / direct .mp4">
            <input className={inputClass} value={section.content?.video_url ?? ""} onChange={(e) => onChange((s) => ({ ...s, content: { ...s.content, video_url: e.target.value } }))} />
          </Field>
          <Field label="Aspect ratio">
            <Select
              value={section.config?.aspect ?? "16:9"}
              onChange={(v) => setConfig("aspect", v)}
              options={[
                { value: "16:9", label: "16:9" },
                { value: "4:3", label: "4:3" },
                { value: "1:1", label: "1:1" },
                { value: "9:16", label: "9:16" },
              ]}
            />
          </Field>
        </>
      )}

      {section.type === "banner" && (
        <>
          <Field label="Title">
            <input className={inputClass} dir={isRTL ? "rtl" : "ltr"} value={get("title")} onChange={(e) => setContent("title", e.target.value)} />
          </Field>
          <Field label="Subtitle">
            <input className={inputClass} dir={isRTL ? "rtl" : "ltr"} value={get("subtitle")} onChange={(e) => setContent("subtitle", e.target.value)} />
          </Field>
          <Field label="Image URL">
            <input className={inputClass} value={section.content?.image_url ?? ""} onChange={(e) => onChange((s) => ({ ...s, content: { ...s.content, image_url: e.target.value } }))} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="CTA text">
              <input className={inputClass} dir={isRTL ? "rtl" : "ltr"} value={get("cta_text")} onChange={(e) => setContent("cta_text", e.target.value)} />
            </Field>
            <Field label="CTA href">
              <input className={inputClass} value={section.content?.cta_href ?? ""} onChange={(e) => onChange((s) => ({ ...s, content: { ...s.content, cta_href: e.target.value } }))} />
            </Field>
          </div>
        </>
      )}

      {section.type === "related_products" && (
        <>
          <Field label="Title">
            <input className={inputClass} dir={isRTL ? "rtl" : "ltr"} value={get("title")} onChange={(e) => setContent("title", e.target.value)} />
          </Field>
          <Field label="Source">
            <Select
              value={section.config?.source ?? "category"}
              onChange={(v) => setConfig("source", v)}
              options={[
                { value: "category", label: "Same category" },
                { value: "featured", label: "Featured products" },
                { value: "latest", label: "Latest products" },
              ]}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Columns">
              <input
                type="number" min={2} max={6} className={inputClass}
                value={section.config?.columns ?? 4}
                onChange={(e) => setConfig("columns", Number.parseInt(e.target.value, 10) || 4)}
              />
            </Field>
            <Field label="Limit">
              <input
                type="number" min={2} max={24} className={inputClass}
                value={section.content?.limit ?? 8}
                onChange={(e) => onChange((s) => ({ ...s, content: { ...s.content, limit: Number.parseInt(e.target.value, 10) || 8 } }))}
              />
            </Field>
          </div>
        </>
      )}

      {section.type === "custom" && (
        <>
          <Field label="Title">
            <input className={inputClass} dir={isRTL ? "rtl" : "ltr"} value={get("title")} onChange={(e) => setContent("title", e.target.value)} />
          </Field>
          <Field label="Subtitle">
            <input className={inputClass} dir={isRTL ? "rtl" : "ltr"} value={get("subtitle")} onChange={(e) => setContent("subtitle", e.target.value)} />
          </Field>
          <Field label="Body">
            <textarea rows={3} dir={isRTL ? "rtl" : "ltr"} className={inputClass} value={get("body")} onChange={(e) => setContent("body", e.target.value)} />
          </Field>
          <Field label="HTML (optional, sanitized)">
            <textarea rows={4} className={inputClass} value={get("html")} onChange={(e) => setContent("html", e.target.value)} />
          </Field>
          <Field label="Image URL">
            <input className={inputClass} value={section.content?.image_url ?? ""} onChange={(e) => onChange((s) => ({ ...s, content: { ...s.content, image_url: e.target.value } }))} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="CTA text">
              <input className={inputClass} dir={isRTL ? "rtl" : "ltr"} value={get("cta_text")} onChange={(e) => setContent("cta_text", e.target.value)} />
            </Field>
            <Field label="CTA href">
              <input className={inputClass} value={section.content?.cta_href ?? ""} onChange={(e) => onChange((s) => ({ ...s, content: { ...s.content, cta_href: e.target.value } }))} />
            </Field>
          </div>
        </>
      )}

      {section.type === "checkout" && (
        <CheckoutEditor section={section} onChange={onChange} get={get} setContent={setContent} setConfig={setConfig} isRTL={isRTL} />
      )}

      <CommonConfigBlock section={section} onChange={onChange} />
    </div>
  );
}

// Re-export to suppress unused-symbol warnings on `GripVertical` import.
export { GripVertical };

// ── Checkout section editor ──────────────────────────────────────────────────
const ALL_CHECKOUT_FIELDS = ["phone", "fullName", "country", "city", "state", "zip", "address"];
const FIELD_LABELS = {
  phone: "Email / Phone",
  fullName: "Full Name",
  country: "Country",
  city: "City",
  state: "State / Province",
  zip: "Zip / Postal Code",
  address: "Street Address",
};

function CheckoutEditor({ section, onChange, get, setContent, setConfig, isRTL }) {
  const cfg = section.config ?? {};
  const visible = Array.isArray(cfg.fields) && cfg.fields.length > 0
    ? cfg.fields
    : ALL_CHECKOUT_FIELDS;
  // Show every field in the editor: in-order visible ones first, then hidden ones.
  const hidden = ALL_CHECKOUT_FIELDS.filter((f) => !visible.includes(f));
  const ordered = [...visible, ...hidden];

  const setFields = (next) => setConfig("fields", next);

  const toggleField = (field) => {
    if (visible.includes(field)) {
      setFields(visible.filter((f) => f !== field));
    } else {
      setFields([...visible, field]);
    }
  };

  const moveField = (field, dir) => {
    const next = [...visible];
    const idx = next.indexOf(field);
    if (idx === -1) return;
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setFields(next);
  };

  const waCountriesValue = Array.isArray(cfg.whatsapp_countries)
    ? cfg.whatsapp_countries.join(", ")
    : "";
  const waAlways = cfg.whatsapp_countries === null;

  return (
    <div className="space-y-4">
      <Field label="Title">
        <input className={inputClass} dir={isRTL ? "rtl" : "ltr"} value={get("title")} onChange={(e) => setContent("title", e.target.value)} />
      </Field>
      <Field label="Subtitle">
        <input className={inputClass} dir={isRTL ? "rtl" : "ltr"} value={get("subtitle")} onChange={(e) => setContent("subtitle", e.target.value)} />
      </Field>

      {/* Field manager */}
      <Field label="Fields (drag the order, toggle to show/hide)">
        <ul className="space-y-1 rounded-lg border border-zinc-200 bg-white p-2">
          {ordered.map((field) => {
            const isVisible = visible.includes(field);
            const idx = visible.indexOf(field);
            return (
              <li
                key={field}
                className={`flex items-center gap-2 rounded-md px-2 py-1.5 ${isVisible ? "bg-zinc-50" : "opacity-60"}`}
              >
                <input
                  type="checkbox"
                  checked={isVisible}
                  onChange={() => toggleField(field)}
                  className="h-4 w-4 rounded accent-blue-600"
                />
                <span className="flex-1 text-sm text-zinc-800">{FIELD_LABELS[field]}</span>
                <button
                  type="button"
                  disabled={!isVisible || idx === 0}
                  onClick={() => moveField(field, -1)}
                  className="rounded-md p-1 text-zinc-400 hover:bg-white disabled:opacity-30"
                >▲</button>
                <button
                  type="button"
                  disabled={!isVisible || idx === visible.length - 1}
                  onClick={() => moveField(field, 1)}
                  className="rounded-md p-1 text-zinc-400 hover:bg-white disabled:opacity-30"
                >▼</button>
              </li>
            );
          })}
        </ul>
      </Field>

      {/* Toggles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg bg-zinc-50 p-3">
        <Toggle label="Show coupon input" value={cfg.show_coupon !== false} onChange={(v) => setConfig("show_coupon", v)} />
        <Toggle label="Show order summary" value={cfg.show_summary !== false} onChange={(v) => setConfig("show_summary", v)} />
        <Toggle label="Show 'Place Order' button" value={cfg.show_place_order !== false} onChange={(v) => setConfig("show_place_order", v)} />
        <Toggle label="Show 'Order via WhatsApp' button" value={cfg.show_whatsapp !== false} onChange={(v) => setConfig("show_whatsapp", v)} />
      </div>

      {/* WhatsApp country restriction */}
      {cfg.show_whatsapp !== false && (
        <Field label="WhatsApp button — restrict to countries" hint="Comma-separated country names. Leave 'always show' checked to display for every country.">
          <div className="flex items-center gap-2 mb-2">
            <input
              type="checkbox"
              checked={waAlways}
              onChange={(e) => setConfig("whatsapp_countries", e.target.checked ? null : ["Morocco"])}
              className="h-4 w-4 rounded accent-blue-600"
            />
            <span className="text-sm text-zinc-700">Always show (any country)</span>
          </div>
          {!waAlways && (
            <input
              className={inputClass}
              value={waCountriesValue}
              onChange={(e) =>
                setConfig(
                  "whatsapp_countries",
                  e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                )
              }
              placeholder="Morocco, France, Spain"
            />
          )}
        </Field>
      )}

      {/* ── Granular text color overrides ── */}
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 space-y-3">
        <p className="text-xs font-semibold text-zinc-600 uppercase tracking-wide">Text colors</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { key: "label_color",       label: "Field labels" },
            { key: "input_text_color",  label: "Input text" },
            { key: "placeholder_color", label: "Placeholder" },
          ].map(({ key, label }) => (
            <Field key={key} label={label}>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="h-9 w-10 rounded-lg border border-zinc-200 cursor-pointer"
                  value={cfg[key] ?? "#111111"}
                  onChange={(e) => setConfig(key, e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setConfig(key, null)}
                  className="text-xs text-zinc-400 hover:text-zinc-700 underline"
                >
                  Reset
                </button>
                {cfg[key] && (
                  <span className="text-xs font-mono text-zinc-500">{cfg[key]}</span>
                )}
              </div>
            </Field>
          ))}
        </div>
      </div>

      {/* ── Button colors (bg + text per button) ── */}
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 space-y-4">
        <p className="text-xs font-semibold text-zinc-600 uppercase tracking-wide">Button colors</p>
        {[
          { bgKey: "order_btn_bg",    textKey: "order_btn_text_color",    label: "Order button",    bgDefault: "#18181b", textDefault: "#ffffff" },
          { bgKey: "whatsapp_btn_bg", textKey: "whatsapp_btn_text_color", label: "WhatsApp button", bgDefault: "#25D366", textDefault: "#ffffff" },
        ].map(({ bgKey, textKey, label, bgDefault, textDefault }) => (
          <div key={bgKey}>
            <p className="text-xs font-medium text-zinc-700 mb-2">{label}</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Background">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    className="h-9 w-10 rounded-lg border border-zinc-200 cursor-pointer"
                    value={cfg[bgKey] ?? bgDefault}
                    onChange={(e) => setConfig(bgKey, e.target.value)}
                  />
                  <button type="button" onClick={() => setConfig(bgKey, null)} className="text-xs text-zinc-400 hover:text-zinc-700 underline">Reset</button>
                  {cfg[bgKey] && <span className="text-xs font-mono text-zinc-500">{cfg[bgKey]}</span>}
                </div>
              </Field>
              <Field label="Text color">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    className="h-9 w-10 rounded-lg border border-zinc-200 cursor-pointer"
                    value={cfg[textKey] ?? textDefault}
                    onChange={(e) => setConfig(textKey, e.target.value)}
                  />
                  <button type="button" onClick={() => setConfig(textKey, null)} className="text-xs text-zinc-400 hover:text-zinc-700 underline">Reset</button>
                  {cfg[textKey] && <span className="text-xs font-mono text-zinc-500">{cfg[textKey]}</span>}
                </div>
              </Field>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
