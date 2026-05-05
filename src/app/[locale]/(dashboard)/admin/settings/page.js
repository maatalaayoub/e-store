"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Store,
  CreditCard,
  Truck,
  Bell,
  Globe,
  Save,
  Zap,
  Eye,
  EyeOff,
  Layers,
  Trash2,
  Plus,
  ChevronUp,
  ChevronDown,
  ImageIcon,
  Loader2,
  Maximize2,
  X as XIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useDictionary } from "@/components/providers/LocaleProvider";
import { AdminSettingsSkeleton } from "@/components/skeletons";
import ConfirmationDialog from "@/components/ui/ConfirmationDialog";

const SECTION_DEFS = [
  { id: "general", icon: Store },
  { id: "hero", icon: Layers },
  { id: "payments", icon: CreditCard },
  { id: "shipping", icon: Truck },
  { id: "notifications", icon: Bell },
  { id: "integrations", icon: Zap },
  { id: "localization", icon: Globe },
];

export default function AdminSettingsPage() {
  const [active, setActive] = useState("general");
  const dict = useDictionary();
  const t = dict?.admin?.settings ?? {};
  const tSec = t.sections ?? {};

  if (!dict?.admin?.settings) return <AdminSettingsSkeleton />;

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900">{t.title}</h1>
        <p className="text-sm text-zinc-500 mt-1">{t.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
        {/* SECTION NAV */}
        <aside className="rounded-xl border border-zinc-100 bg-white p-2 h-max">
          <nav className="flex flex-wrap lg:flex-col gap-1">
            {SECTION_DEFS.map((s) => {
              const Icon = s.icon;
              const isActive = active === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setActive(s.id)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                    isActive
                      ? "bg-blue-50 text-blue-600"
                      : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tSec[s.id] ?? s.id}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* CONTENT */}
        <section className="rounded-xl border border-zinc-100 bg-white p-6">
          {active === "general" && <GeneralSection />}
          {active === "hero" && <HeroSection />}
          {active === "payments" && <PaymentsSection />}
          {active === "shipping" && <ShippingSection />}
          {active === "notifications" && <NotificationsSection />}
          {active === "integrations" && <IntegrationsSection />}
          {active === "localization" && <LocalizationSection />}
        </section>
      </div>
    </>
  );
}

function SectionSaveButton({ onSave }) {
  const [saving, setSaving] = useState(false);
  const dict = useDictionary();
  const label = dict?.admin?.settings?.save ?? 'Save changes';

  const handle = async () => {
    setSaving(true);
    try {
      await onSave?.();
      toast.success('Saved');
    } catch (err) {
      toast.error(err?.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pt-4 mt-2 border-t border-zinc-100 flex justify-end">
      <button
        onClick={handle}
        disabled={saving}
        className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
      >
        <Save className="h-4 w-4" />
        {saving ? '…' : label}
      </button>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-6 py-4 border-b border-zinc-100 last:border-0">
      <div>
        <label className="text-sm font-medium text-zinc-900">{label}</label>
        {hint && <p className="text-xs text-zinc-500 mt-1">{hint}</p>}
      </div>
      <div className="sm:col-span-2">{children}</div>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-blue-600";

function SectionHeader({ title, description }) {
  return (
    <div className="pb-4 mb-2 border-b border-zinc-100">
      <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
      <p className="text-sm text-zinc-500 mt-1">{description}</p>
    </div>
  );
}

function GeneralSection() {
  const t = useDictionary()?.admin?.settings?.general ?? {};
  return (
    <>
      <SectionHeader
        title={t.title}
        description={t.desc}
      />
      <Field label={t.store_name} hint={t.store_name_hint}>
        <input className={inputClass} defaultValue="My store" />
      </Field>
      <Field label={t.contact_email}>
        <input
          type="email"
          className={inputClass}
          placeholder="hello@mystore.com"
        />
      </Field>
      <Field label={t.description} hint={t.description_hint}>
        <textarea
          rows={3}
          className={inputClass}
          placeholder={t.description_placeholder}
        />
      </Field>
      <SectionSaveButton />
    </>
  );
}

function PaymentsSection() {
  const t = useDictionary()?.admin?.settings?.payments ?? {};
  return (
    <>
      <SectionHeader
        title={t.title}
        description={t.desc}
      />
      <Field label={t.currency}>
        <select className={inputClass}>
          <option>USD — US Dollar</option>
          <option>EUR — Euro</option>
          <option>MAD — Moroccan Dirham</option>
        </select>
      </Field>
      <Field label={t.stripe} hint={t.stripe_hint}>
        <input
          type="password"
          className={inputClass}
          placeholder="sk_live_..."
        />
      </Field>
      <Field label={t.cod}>
        <Toggle defaultChecked />
      </Field>
      <SectionSaveButton />
    </>
  );
}

function ShippingSection() {
  const t = useDictionary()?.admin?.settings?.shipping ?? {};
  return (
    <>
      <SectionHeader
        title={t.title}
        description={t.desc}
      />
      <Field label={t.origin}>
        <input className={inputClass} defaultValue="Morocco" />
      </Field>
      <Field label={t.flat} hint={t.flat_hint}>
        <input className={inputClass} defaultValue="5.00" />
      </Field>
      <Field label={t.free_threshold}>
        <input className={inputClass} placeholder="100.00" />
      </Field>
      <SectionSaveButton />
    </>
  );
}

function NotificationsSection() {
  const t = useDictionary()?.admin?.settings?.notifications ?? {};
  return (
    <>
      <SectionHeader
        title={t.title}
        description={t.desc}
      />
      <Field label={t.new_order}>
        <Toggle defaultChecked />
      </Field>
      <Field label={t.low_stock}>
        <Toggle defaultChecked />
      </Field>
      <Field label={t.weekly}>
        <Toggle />
      </Field>
      <SectionSaveButton />
    </>
  );
}

function IntegrationsSection() {
  const t = useDictionary()?.admin?.settings?.integrations ?? {};
  const [form, setForm] = useState({
    telegram_bot_token: '',
    telegram_chat_id: '',
    whatsapp_number: '',
    whatsapp_business_name: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showToken, setShowToken] = useState(false);

  useEffect(() => {
    fetch('/api/v1/settings')
      .then((r) => r.json())
      .then(({ success, data }) => {
        if (success && data) {
          setForm({
            telegram_bot_token: data.telegram_bot_token ?? '',
            telegram_chat_id: data.telegram_chat_id ?? '',
            whatsapp_number: data.whatsapp_number ?? '',
            whatsapp_business_name: data.whatsapp_business_name ?? '',
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/v1/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? 'Save failed');
      toast.success(t.saved ?? 'Settings saved');
    } catch (err) {
      toast.error(err.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-10 rounded-lg bg-zinc-100" />
        ))}
      </div>
    );
  }

  return (
    <>
      <SectionHeader
        title={t.title ?? 'Integrations'}
        description={t.desc ?? 'Connect Telegram and WhatsApp Business to receive order notifications.'}
      />

      {/* Telegram */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-zinc-700 mb-3 flex items-center gap-2">
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-blue-500" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.941z"/>
          </svg>
          {t.telegram ?? 'Telegram Bot'}
        </h3>
        <Field label={t.bot_token ?? 'Bot Token'} hint={t.bot_token_hint ?? 'Get it from @BotFather on Telegram'}>
          <div className="relative">
            <input
              className={`${inputClass} pr-10`}
              type={showToken ? 'text' : 'password'}
              placeholder={form.telegram_bot_token ? undefined : '1234567890:ABCdef...'}
              value={form.telegram_bot_token}
              onChange={handleChange('telegram_bot_token')}
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => setShowToken((v) => !v)}
              className="absolute inset-y-0 right-3 flex items-center text-zinc-400 hover:text-zinc-700"
              tabIndex={-1}
            >
              {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>
        <Field label={t.chat_id ?? 'Chat ID'} hint={t.chat_id_hint ?? 'The chat or group ID to receive order alerts'}>
          <input
            className={inputClass}
            placeholder="-100123456789"
            value={form.telegram_chat_id}
            onChange={handleChange('telegram_chat_id')}
          />
        </Field>
      </div>

      {/* WhatsApp Business */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-zinc-700 mb-3 flex items-center gap-2">
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-green-500" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          {t.whatsapp ?? 'WhatsApp Business'}
        </h3>
        <Field label={t.whatsapp_number ?? 'Business Phone'} hint={t.whatsapp_number_hint ?? 'Include country code, no + or spaces (e.g. +212600000000)'}>
          <input
            className={inputClass}
            placeholder="+212600000000"
            value={form.whatsapp_number}
            onChange={handleChange('whatsapp_number')}
          />
        </Field>
        <Field label={t.whatsapp_name ?? 'Business Name'}>
          <input
            className={inputClass}
            placeholder="My store"
            value={form.whatsapp_business_name}
            onChange={handleChange('whatsapp_business_name')}
          />
        </Field>
      </div>

      <div className="pt-2 border-t border-zinc-100 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {saving ? (t.saving ?? 'Saving…') : (t.save_btn ?? 'Save Integrations')}
        </button>
      </div>
    </>
  );
}

function LocalizationSection() {
  const t = useDictionary()?.admin?.settings?.localization ?? {};
  return (
    <>
      <SectionHeader
        title={t.title}
        description={t.desc}
      />
      <Field label={t.default_language}>
        <select className={inputClass}>
          <option value="en">English</option>
          <option value="fr">Français</option>
          <option value="ar">العربية</option>
          <option value="dr">Darija</option>
        </select>
      </Field>
      <Field label={t.timezone}>
        <select className={inputClass}>
          <option>UTC</option>
          <option>Africa/Casablanca</option>
          <option>Europe/Paris</option>
        </select>
      </Field>
      <SectionSaveButton />
    </>
  );
}

function HeroSection() {
  const dict = useDictionary();
  const t = dict?.admin?.settings?.hero ?? {};
  const [slides, setSlides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState({}); // { [idx]: true }
  const [confirmDelete, setConfirmDelete] = useState(null); // idx to confirm
  const [previewImage, setPreviewImage] = useState(null); // url to preview fullscreen

  useEffect(() => {
    fetch('/api/v1/admin/hero-slides')
      .then((r) => r.json())
      .then((json) => { if (json.success) setSlides(json.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const update = (idx, field, value) =>
    setSlides((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));

  const move = (idx, dir) => {
    const next = [...slides];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setSlides(next);
  };

  const add = () =>
    setSlides((prev) => [
      ...prev,
      { image_url: '', title: '', cta_text: '', href: '/shop', is_active: true },
    ]);

  const remove = (idx) => {
    setSlides((prev) => prev.filter((_, i) => i !== idx));
    setConfirmDelete(null);
  };

  const handleImageUpload = async (idx, file) => {
    if (!file) return;
    setUploading((prev) => ({ ...prev, [idx]: true }));
    try {
      const supabase = createClient();
      const ext = file.name.split('.').pop();
      const path = `hero/${Date.now()}_${idx}.${ext}`;
      const { error } = await supabase.storage
        .from('hero-images')
        .upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage
        .from('hero-images')
        .getPublicUrl(path);
      update(idx, 'image_url', publicUrl);
    } catch (err) {
      toast.error((t.upload_error ?? 'Image upload failed') + ': ' + (err?.message ?? 'Unknown error'));
    } finally {
      setUploading((prev) => ({ ...prev, [idx]: false }));
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/v1/admin/hero-slides', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slides }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? 'Save failed');
      toast.success(t.saved ?? 'Hero slides saved');
    } catch (err) {
      toast.error(err.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-zinc-100" />
        ))}
      </div>
    );
  }

  return (
    <>
      <SectionHeader
        title={t.title ?? "Hero Carousel"}
        description={t.desc ?? "Manage the slides shown on the homepage hero section. Changes are live immediately after saving."}
      />

      <div className="flex flex-col gap-4 mb-4">
        {slides.length === 0 && (
          <p className="text-sm text-zinc-400 text-center py-8">
            {t.no_slides ?? "No slides yet. Add one below."}
          </p>
        )}
        {slides.map((slide, idx) => (
          <div key={idx} className="border border-zinc-200 rounded-xl p-4 flex flex-col gap-3">
            {/* Header row */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">{t.slide ?? "Slide"} {idx + 1}</span>
              <div className="flex items-center gap-1">
                <button onClick={() => move(idx, -1)} disabled={idx === 0} className="p-1 rounded text-zinc-400 hover:text-zinc-700 disabled:opacity-30" title="Move up">
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button onClick={() => move(idx, 1)} disabled={idx === slides.length - 1} className="p-1 rounded text-zinc-400 hover:text-zinc-700 disabled:opacity-30" title="Move down">
                  <ChevronDown className="h-4 w-4" />
                </button>
                <button onClick={() => setConfirmDelete(idx)} className="p-1 rounded text-red-400 hover:text-red-600" title="Remove slide">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Image upload area */}
            <label className={`relative flex flex-col items-center justify-center w-full rounded-xl border-2 border-dashed cursor-pointer overflow-hidden transition-colors ${slide.image_url ? 'border-transparent' : 'border-zinc-200 hover:border-blue-400 bg-zinc-50 hover:bg-blue-50'}`} style={{ minHeight: '10rem' }}>
              {uploading[idx] ? (
                <div className="flex flex-col items-center gap-2 py-8 text-zinc-400">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="text-sm">{t.uploading ?? "Uploading…"}</span>
                </div>
              ) : slide.image_url ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={slide.image_url} alt="" className="w-full h-40 object-cover rounded-xl" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-3 rounded-xl">
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); setPreviewImage(slide.image_url); }}
                      className="flex items-center gap-1.5 rounded-lg bg-white/20 hover:bg-white/30 px-3 py-2 text-white text-sm font-medium backdrop-blur-sm transition-colors"
                    >
                      <Maximize2 className="h-4 w-4" /> {t.preview_image ?? "Preview"}
                    </button>
                    <span className="text-white text-sm font-medium flex items-center gap-1"><ImageIcon className="h-4 w-4" /> {t.change_image ?? "Change image"}</span>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-2 py-8 text-zinc-400">
                  <ImageIcon className="h-8 w-8" />
                  <span className="text-sm font-medium">{t.image_label ?? "Click to upload image"}</span>
                  <span className="text-xs">{t.image_hint ?? "JPG, PNG, WebP"}</span>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleImageUpload(idx, e.target.files?.[0])}
              />
            </label>

            <input
              className={inputClass}
              placeholder={t.title_placeholder ?? "Title (e.g. THE LUXURY YOU DESERVE)"}
              value={slide.title}
              onChange={(e) => update(idx, 'title', e.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                className={inputClass}
                placeholder={t.cta_placeholder ?? "Button text (e.g. SHOP NOW)"}
                value={slide.cta_text}
                onChange={(e) => update(idx, 'cta_text', e.target.value)}
              />
              <input
                className={inputClass}
                placeholder={t.link_placeholder ?? "Link path (e.g. /shop)"}
                value={slide.href}
                onChange={(e) => update(idx, 'href', e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Toggle
                defaultChecked={slide.is_active}
                onChange={(val) => update(idx, 'is_active', val)}
              />
              <span className="text-sm text-zinc-600">{t.active ?? "Active"}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-zinc-100">
        <button
          onClick={add}
          className="flex items-center gap-2 rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          <Plus className="h-4 w-4" />
          {t.add_slide ?? "Add Slide"}
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {saving ? (t.saving ?? 'Saving…') : (t.save ?? 'Save Slides')}
        </button>
      </div>

      {/* ── Fullscreen image preview ── */}
      {previewImage && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setPreviewImage(null)}
        >
          <button
            onClick={() => setPreviewImage(null)}
            className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="Close preview"
          >
            <XIcon className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewImage}
            alt="Hero preview"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] max-w-full rounded-xl object-contain shadow-2xl"
          />
        </div>,
        document.body
      )}

      {/* ── Delete confirmation dialog ── */}
      <ConfirmationDialog
        isOpen={confirmDelete !== null}
        title={t.dialog_title ?? "Delete Slide"}
        description={t.dialog_desc ?? "Are you sure you want to delete this slide? This action cannot be undone."}
        confirmText={t.yes ?? "Yes, delete"}
        cancelText={t.no ?? "Cancel"}
        icon={<Trash2 className="h-5 w-5" />}
        onConfirm={() => remove(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
    </>
  );
}

function Toggle({ defaultChecked = false, onChange }) {
  const [on, setOn] = useState(defaultChecked);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => {
        const next = !on;
        setOn(next);
        onChange?.(next);
      }}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        on ? "bg-blue-600" : "bg-zinc-300"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          on ? "translate-x-6 rtl:-translate-x-6" : "translate-x-1 rtl:-translate-x-1"
        }`}
      />
    </button>
  );
}
