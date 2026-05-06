"use client";

import { useState, useEffect, useRef } from "react";
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
  Megaphone,
  Clock,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { invalidateBarCache, MarqueePreview, Countdown, SwapStack } from "@/components/shop/AnnouncementBar";
import { toast } from "sonner";
import { useDictionary } from "@/components/providers/LocaleProvider";
import { AdminSettingsSkeleton } from "@/components/skeletons";
import ConfirmationDialog from "@/components/ui/ConfirmationDialog";

const SECTION_DEFS = [
  { id: "general", icon: Store },
  { id: "hero", icon: Layers },
  { id: "announcements", icon: Megaphone },
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
          {active === "announcements" && <AnnouncementsSection />}
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

/* ────────────────────────────────────────────────────────────
   ANNOUNCEMENTS SECTION  – redesigned
   ──────────────────────────────────────────────────────────── */

const ANNOUNCEMENT_TYPES = [
  { id: 'promotion',    label: 'Promotion',     bg: '#0f172a', text: '#ffffff', icon: 'megaphone' },
  { id: 'shipping',     label: 'Shipping',      bg: '#065f46', text: '#ffffff', icon: 'truck'     },
  { id: 'limited',      label: 'Limited Offer', bg: '#7f1d1d', text: '#ffffff', icon: 'clock'     },
  { id: 'social',       label: 'Social',        bg: '#1e3a8a', text: '#ffffff', icon: 'whatsapp'  },
  { id: 'notification', label: 'Notification',  bg: '#1f2937', text: '#ffffff', icon: 'bell'      },
  { id: 'marquee',      label: 'Scrolling',     bg: '#0b3b2e', text: '#ffffff', icon: 'megaphone' },
];

const ICON_OPTIONS = ['megaphone', 'truck', 'clock', 'bell', 'whatsapp', 'facebook', 'instagram', 'tiktok'];

/* Brand SVG icons */
function BrandIcon({ name, className: cls = 'h-4 w-4' }) {
  if (name === 'whatsapp') return (
    <svg className={cls} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
  if (name === 'facebook') return (
    <svg className={cls} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  );
  if (name === 'instagram') return (
    <svg className={cls} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
    </svg>
  );
  if (name === 'tiktok') return (
    <svg className={cls} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.76a4.85 4.85 0 01-1.01-.07z"/>
    </svg>
  );
  return null;
}

/* Icon renderer shared by both card and drawer announcement previews */
const PREVIEW_ICONS = { megaphone: Megaphone, truck: Truck, clock: Clock, bell: Bell };
function PreviewAnnouncementIcon({ icon, className = 'h-3.5 w-3.5 shrink-0' }) {
  const LucideIcon = PREVIEW_ICONS[icon];
  if (LucideIcon) return <LucideIcon className={className} />;
  if (['whatsapp', 'facebook', 'instagram', 'tiktok'].includes(icon)) return <BrandIcon name={icon} className={className} />;
  return null;
}

const SOCIAL_PLATFORMS = [
  { id: 'whatsapp',  label: 'WhatsApp',  color: '#25D366', field: 'social_whatsapp',  placeholder: '212600000000',  hrefFn: (v) => `https://wa.me/${v}` },
  { id: 'facebook',  label: 'Facebook',  color: '#1877F2', field: 'social_facebook',  placeholder: 'your.page',     hrefFn: (v) => `https://facebook.com/${v}` },
  { id: 'instagram', label: 'Instagram', color: '#E4405F', field: 'social_instagram', placeholder: 'your.handle',   hrefFn: (v) => `https://instagram.com/${v}` },
  { id: 'tiktok',    label: 'TikTok',    color: '#000000', field: 'social_tiktok',    placeholder: '@yourhandle',   hrefFn: (v) => `https://tiktok.com/${v}` },
];

function blankAnnouncement(type = 'promotion') {
  const tp = ANNOUNCEMENT_TYPES.find((x) => x.id === type) ?? ANNOUNCEMENT_TYPES[0];
  return {
    type, text: '', icon_enabled: true, icon: tp.icon,
    bg_color: tp.bg, text_color: tp.text, font_size: 14, border_enabled: false,
    cta_text: '', cta_href: '', promo_code: '',
    cta_display_mode: type === 'social' ? 'static' : 'swap',
    cta_swap_seconds: 4,
    social_whatsapp: '', social_facebook: '', social_instagram: '', social_tiktok: '',
    social_platforms: ['whatsapp'],
    marquee_messages: type === 'marquee' ? [''] : [],
    marquee_speed: 60,
    marquee_direction: 'left',
    marquee_pause_on_hover: true,
    marquee_separator: '•',
    marquee_scroll_mode: 'together',
    position: 'top', behavior: 'sticky', scope: 'all',
    carousel_enabled: false, rotation_seconds: 5, dismissible: true,
    start_at: null, end_at: null, priority: 0, is_active: true,
  };
}

function isoToLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function localInputToIso(local) {
  if (!local) return null;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function AnnouncementSelect({ value, onChange, options, placeholder }) {
  const [open, setOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const wrapRef = useRef(null);
  const btnRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggleOpen = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setOpenUp(spaceBelow < 220 && rect.top > spaceBelow);
    }
    setOpen((v) => !v);
  };

  const selected = options?.find((o) => o.value === value);

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={toggleOpen}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`w-full flex items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2 text-sm shadow-sm outline-none transition-all cursor-pointer ${
          open
            ? 'border-blue-400 ring-2 ring-blue-100'
            : 'border-zinc-200 hover:border-zinc-300'
        }`}
      >
        <span className={`truncate ${selected ? 'text-zinc-800' : 'text-zinc-400'}`}>
          {selected?.label ?? placeholder ?? '—'}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 text-zinc-400 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <ul
          role="listbox"
          className={`absolute left-0 right-0 z-30 max-h-56 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-1 shadow-lg ring-1 ring-black/5 ${
            openUp ? 'bottom-full mb-1' : 'top-full mt-1'
          }`}
        >
          {options?.map((opt) => {
            const active = opt.value === value;
            return (
              <li key={String(opt.value)}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange?.({ target: { value: opt.value } });
                    setOpen(false);
                  }}
                  className={`w-full text-left px-2.5 py-1.5 text-sm rounded-md transition-colors capitalize ${
                    active
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-zinc-700 hover:bg-zinc-50'
                  }`}
                >
                  {opt.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function AnnouncementRow({ value, t, isFirst, isLast, onMove, onDelete, onToggle, onEdit }) {
  const typeInfo = ANNOUNCEMENT_TYPES.find((x) => x.id === value.type) ?? ANNOUNCEMENT_TYPES[0];
  return (
    <div
      className={`group rounded-md border transition-all ${
        value.is_active
          ? 'border-zinc-200 bg-white hover:border-zinc-300'
          : 'border-zinc-100 bg-zinc-50/50'
      }`}
    >
      {/* Live preview bar */}
      <div
        className={`rounded-t-md overflow-hidden text-xs sm:text-sm font-medium ${
          value.is_active ? '' : 'opacity-50 grayscale'
        }`}
        style={{
          backgroundColor: value.bg_color || typeInfo.bg,
          color: value.text_color || typeInfo.text,
          fontSize: value.font_size ? `${Math.min(value.font_size, 14)}px` : undefined,
          borderBottom: value.border_enabled ? '1px solid rgba(0,0,0,0.15)' : 'none',
        }}
      >
        {value.type === 'marquee' ? (
          <div className="py-2.5">
            {((value.marquee_messages ?? []).filter((m) => m && m.trim().length)).length > 0
              ? <MarqueePreview a={value} />
              : <p className="text-center opacity-60 italic px-4">{t.preview_placeholder ?? 'Your message preview…'}</p>
            }
          </div>
        ) : (
          <div className="px-4 py-2.5 text-center">
            <span className="inline-flex items-center gap-1.5 flex-wrap justify-center">
              {value.icon_enabled && value.icon && value.type !== 'social' && (
                <PreviewAnnouncementIcon icon={value.icon} className="h-3.5 w-3.5 shrink-0" />
              )}
              {(() => {
                const textNode = <span>{value.text || <span className="opacity-60 italic">{t.preview_placeholder ?? 'Your message preview…'}</span>}</span>;
                const ctaNode = value.cta_text ? (
                  <span className="px-3 py-1.5 rounded-full bg-white text-black text-[11px] font-bold tracking-wide shadow-sm">{value.cta_text}</span>
                ) : null;
                if (ctaNode && value.cta_display_mode === 'swap') {
                  return <SwapStack textNode={textNode} buttonNode={ctaNode} seconds={value.cta_swap_seconds ?? 4} />;
                }
                return <>{textNode}{ctaNode && <span className="ms-1">{ctaNode}</span>}</>;
              })()}
              {value.type === 'promotion' && value.promo_code && (
                <span className="px-2 py-0.5 rounded bg-white/20 font-mono text-[11px]">{value.promo_code}</span>
              )}
              {value.type === 'limited' && value.end_at && (
                <Countdown endAt={value.end_at} labels={{ d: 'd', h: 'h', m: 'm', s: 's' }} />
              )}
              {value.type === 'social' && (() => {
                const platforms = (value.social_platforms ?? []).filter((pid) => value[`social_${pid}`]);
                if (platforms.length === 0) return null;
                return platforms.map((pid) => {
                  const p = SOCIAL_PLATFORMS.find((x) => x.id === pid);
                  if (!p) return null;
                  return (
                    <span key={pid} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/20 text-[11px] font-semibold">
                      <BrandIcon name={pid} className="h-3 w-3" />
                      {p.label}
                    </span>
                  );
                });
              })()}
            </span>
          </div>
        )}
      </div>

      {/* Meta + actions */}
      <div className="flex items-center gap-3 px-3 sm:px-4 py-2.5">
        <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize"
          style={{ backgroundColor: `${typeInfo.bg}1a`, color: typeInfo.bg }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: typeInfo.bg }} />
          {t[`type_${value.type}`] ?? typeInfo.label}
        </span>
        <span className="text-[11px] text-zinc-400 capitalize hidden sm:inline">
          {value.position ?? 'top'} · {value.scope ?? 'all'}
        </span>
        <div className="flex-1" />
        <div className="flex items-center gap-0.5">
          <button onClick={() => onMove(-1)} disabled={isFirst}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 disabled:opacity-25 transition-colors"
            aria-label={t.move_up ?? 'Move up'}>
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => onMove(1)} disabled={isLast}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 disabled:opacity-25 transition-colors"
            aria-label={t.move_down ?? 'Move down'}>
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <div className="mx-1">
            <Toggle defaultChecked={value.is_active} onChange={onToggle} />
          </div>
          <button onClick={onEdit}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            aria-label={t.edit ?? 'Edit'}>
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button onClick={onDelete}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            aria-label={t.delete ?? 'Delete'}>
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* Type-picker dialog shown before creating a new announcement */
function AnnouncementTypePicker({ open, t, onPick, onClose }) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMounted(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const close = () => {
    setVisible(false);
    setTimeout(() => { setMounted(false); onClose(); }, 220);
  };

  if (!open || !mounted) return null;

  return createPortal(
    <>
      <div onClick={close}
        className={`fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0'}`} />
      <div
        className={`fixed z-[71] left-1/2 top-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-md bg-white rounded-lg shadow-2xl transition-all duration-200 ${
          visible ? '-translate-y-1/2 opacity-100 scale-100' : '-translate-y-[45%] opacity-0 scale-95'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">{t.pick_type_title ?? 'Choose announcement type'}</h2>
            <p className="text-xs text-zinc-500 mt-0.5">{t.pick_type_desc ?? 'Select what kind of banner you want to create.'}</p>
          </div>
          <button onClick={close} className="p-2 rounded-lg hover:bg-zinc-100 text-zinc-500 transition-colors">
            <XIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {ANNOUNCEMENT_TYPES.map((tp) => (
            <button
              key={tp.id}
              type="button"
              onClick={() => { onPick(tp.id); close(); }}
              className="group flex items-center gap-3 rounded-xl border border-zinc-100 bg-white px-3 py-3 text-left hover:border-blue-200 hover:bg-blue-50/30 transition-colors"
            >
              <span className="h-9 w-9 rounded-lg flex items-center justify-center text-white shrink-0"
                style={{ backgroundColor: tp.bg }}>
                <Megaphone className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-zinc-800 capitalize">{t[`type_${tp.id}`] ?? tp.label}</p>
                <p className="text-[11px] text-zinc-400 truncate">{t[`type_${tp.id}_desc`] ?? `${tp.label} banner`}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </>,
    document.body
  );
}

function AnnouncementDrawer({ value, t, onUpdate, onClose, onSaveRow, saving }) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setMounted(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    if (mounted) document.body.style.overflow = 'hidden';
  }, [mounted]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 280);
  };

  if (!mounted) return null;

  const togglePlatform = (pid) => {
    const cur = value.social_platforms ?? [];
    const next = cur.includes(pid) ? cur.filter((x) => x !== pid) : [...cur, pid];
    onUpdate('social_platforms', next);
  };

  const inputCls = "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all";

  const content = (
    <>
      <div
        onClick={handleClose}
        className={`fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <div
        className={`fixed z-[61] bg-white flex flex-col shadow-2xl
          left-2 right-2 bottom-2 rounded-lg max-h-[88dvh]
          sm:left-1/2 sm:-translate-x-1/2 sm:bottom-4 sm:w-[min(560px,calc(100%-2rem))] sm:max-h-[88vh]
          transition-all duration-300 ease-out
          ${visible
            ? 'translate-y-0 opacity-100 sm:-translate-x-1/2'
            : 'translate-y-[110%] opacity-0 sm:-translate-x-1/2'}`}
      >
        {/* Drag handle (mobile) */}
        <div className="sm:hidden flex justify-center pt-2 pb-1 shrink-0">
          <div className="h-1 w-10 rounded-full bg-zinc-200" />
        </div>

        <div className="flex items-center justify-between px-5 py-3 sm:py-4 border-b border-zinc-100 shrink-0">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-zinc-900 truncate">{t.edit_title ?? 'Edit Announcement'}</h2>
            <p className="text-xs text-zinc-400 mt-0.5 capitalize">{t[`type_${value.type}`] ?? value.type}</p>
          </div>
          <button onClick={handleClose} className="p-2 rounded-lg hover:bg-zinc-100 text-zinc-500 transition-colors shrink-0">
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-5">
          {/* Preview */}
          <div
            className="rounded-xl overflow-hidden text-sm font-medium"
            style={{
              backgroundColor: value.bg_color || '#111',
              color: value.text_color || '#fff',
              border: value.border_enabled ? '1px solid rgba(0,0,0,0.15)' : 'none',
              fontSize: value.font_size ? `${value.font_size}px` : undefined,
            }}
          >
            {value.type === 'marquee' ? (
              <div className="py-3">
                {((value.marquee_messages ?? []).filter((m) => m && m.trim().length)).length > 0
                  ? <MarqueePreview a={value} />
                  : <p className="text-center opacity-50 py-0.5">{t.preview_placeholder ?? 'Your message preview…'}</p>
                }
              </div>
            ) : (
              <div className="px-4 py-3 text-center">
                <span className="inline-flex items-center gap-2 flex-wrap justify-center">
                  {value.icon_enabled && value.icon && value.type !== 'social' && (
                    <PreviewAnnouncementIcon icon={value.icon} className="h-4 w-4 shrink-0" />
                  )}
                  {(() => {
                    const textNode = <span>{value.text || <span className="opacity-50">{t.preview_placeholder ?? 'Your message preview…'}</span>}</span>;
                    const ctaNode = value.cta_text ? (
                      <span className="px-4 py-2 rounded-full bg-white text-black text-xs font-bold tracking-wide shadow-sm">{value.cta_text}</span>
                    ) : null;
                    if (ctaNode && value.cta_display_mode === 'swap') {
                      return <SwapStack textNode={textNode} buttonNode={ctaNode} seconds={value.cta_swap_seconds ?? 4} />;
                    }
                    return <>{textNode}{ctaNode && <span className="ms-1">{ctaNode}</span>}</>;
                  })()}
                  {value.type === 'promotion' && value.promo_code && (
                    <span className="px-2 py-0.5 rounded bg-white/20 font-mono text-xs">{value.promo_code}</span>
                  )}
                  {value.type === 'limited' && value.end_at && (
                    <Countdown endAt={value.end_at} labels={{ d: 'd', h: 'h', m: 'm', s: 's' }} />
                  )}
                  {value.type === 'social' && (() => {
                    const platforms = (value.social_platforms ?? []).filter((pid) => value[`social_${pid}`]);
                    if (platforms.length === 0) return null;
                    return platforms.map((pid) => {
                      const p = SOCIAL_PLATFORMS.find((x) => x.id === pid);
                      if (!p) return null;
                      return (
                        <span key={pid} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/20 text-xs font-semibold">
                          <BrandIcon name={pid} className="h-3.5 w-3.5" />
                          {p.label}
                        </span>
                      );
                    });
                  })()}
                </span>
              </div>
            )}
          </div>

          {/* Message (single-line types) */}
          {value.type !== 'marquee' && (
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1.5">{t.text ?? 'Message'}</label>
              <input className={inputCls} placeholder={t.text_placeholder ?? 'e.g. Free shipping on orders over $99'} value={value.text} onChange={(e) => onUpdate('text', e.target.value)} />
            </div>
          )}

          {/* Marquee messages list + controls */}
          {value.type === 'marquee' && (
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-zinc-600">{t.marquee_messages ?? 'Messages'}</label>
                  <button
                    type="button"
                    onClick={() => onUpdate('marquee_messages', [...(value.marquee_messages ?? []), ''])}
                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                  >
                    <Plus className="h-3.5 w-3.5" /> {t.marquee_add_message ?? 'Add message'}
                  </button>
                </div>
                <div className="space-y-2">
                  {(value.marquee_messages ?? []).map((msg, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        className={inputCls}
                        placeholder={t.marquee_message_placeholder ?? `Message ${i + 1}`}
                        value={msg}
                        onChange={(e) => {
                          const next = [...(value.marquee_messages ?? [])];
                          next[i] = e.target.value;
                          onUpdate('marquee_messages', next);
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const next = (value.marquee_messages ?? []).filter((_, j) => j !== i);
                          onUpdate('marquee_messages', next);
                        }}
                        className="p-2 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                        aria-label={t.delete ?? 'Delete'}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1.5">
                    {t.marquee_speed ?? 'Speed'} ({value.marquee_speed ?? 60})
                  </label>
                  <input
                    type="range" min={10} max={400} step={5}
                    value={value.marquee_speed ?? 60}
                    onChange={(e) => onUpdate('marquee_speed', Number(e.target.value))}
                    className="w-full accent-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1.5">{t.marquee_separator ?? 'Separator'}</label>
                  <input
                    className={inputCls}
                    placeholder="•"
                    value={value.marquee_separator ?? '•'}
                    onChange={(e) => onUpdate('marquee_separator', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1.5">{t.marquee_direction ?? 'Direction'}</label>
                  <AnnouncementSelect
                    value={value.marquee_direction ?? 'left'}
                    onChange={(e) => onUpdate('marquee_direction', e.target.value)}
                    options={[
                      { value: 'left', label: t.marquee_direction_left ?? 'Left' },
                      { value: 'right', label: t.marquee_direction_right ?? 'Right' },
                    ]}
                  />
                </div>
                <label className="flex items-end justify-between gap-2 rounded-lg border border-zinc-100 px-3 py-2 cursor-pointer hover:bg-zinc-50">
                  <span className="text-xs text-zinc-700">{t.marquee_pause_on_hover ?? 'Pause on hover'}</span>
                  <Toggle defaultChecked={value.marquee_pause_on_hover !== false} onChange={(v) => onUpdate('marquee_pause_on_hover', v)} />
                </label>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-zinc-600 mb-1.5">{t.marquee_scroll_mode ?? 'Scroll mode'}</label>
                  <AnnouncementSelect
                    value={value.marquee_scroll_mode ?? 'together'}
                    onChange={(e) => onUpdate('marquee_scroll_mode', e.target.value)}
                    options={[
                      { value: 'together', label: t.marquee_scroll_together ?? 'All together' },
                      { value: 'individual', label: t.marquee_scroll_individual ?? 'One by one' },
                    ]}
                  />
                  <p className="text-xs text-zinc-400 mt-1">
                    {value.marquee_scroll_mode === 'individual'
                      ? (t.marquee_scroll_individual_hint ?? 'Each message scrolls across fully before the next one enters.')
                      : (t.marquee_scroll_together_hint ?? 'All messages scroll in a continuous looping band.')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {value.type === 'promotion' && (
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1.5">{t.promo_code ?? 'Promo code'}</label>
              <input className={inputCls} placeholder="SUMMER25" value={value.promo_code ?? ''} onChange={(e) => onUpdate('promo_code', e.target.value)} />
              <p className="text-xs text-zinc-400 mt-1">{t.promo_code_hint ?? 'Customers can copy with one click.'}</p>
            </div>
          )}

          {value.type === 'social' && (
            <div className="space-y-2.5">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">{t.social_platforms_label ?? 'Platforms'}</p>
              {SOCIAL_PLATFORMS.map((p) => {
                const enabled = (value.social_platforms ?? []).includes(p.id);
                return (
                  <div key={p.id} className={`rounded-xl border p-3 transition-all ${
                    enabled ? 'border-zinc-300 bg-zinc-50/60' : 'border-zinc-100 bg-white'
                  }`}>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox" checked={enabled} onChange={() => togglePlatform(p.id)}
                        className="h-4 w-4 rounded border-zinc-300 accent-blue-600"
                      />
                      <span className="h-7 w-7 rounded-lg flex items-center justify-center text-white shrink-0" style={{ backgroundColor: p.color }}>
                        <BrandIcon name={p.id} className="h-3.5 w-3.5" />
                      </span>
                      <span className="text-sm font-medium text-zinc-800 flex-1">{p.label}</span>
                    </label>
                    {enabled && (
                      <input className={`${inputCls} mt-2.5`} placeholder={p.placeholder} value={value[p.field] ?? ''} onChange={(e) => onUpdate(p.field, e.target.value)} />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {value.type !== 'marquee' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1.5">{t.cta_text ?? 'Button text'}</label>
                  <input className={inputCls} placeholder={t.cta_text_placeholder ?? 'Shop now'} value={value.cta_text ?? ''} onChange={(e) => onUpdate('cta_text', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1.5">{t.cta_href ?? 'Link URL'}</label>
                  <input className={inputCls} placeholder={t.cta_href_placeholder ?? '/shop'} value={value.cta_href ?? ''} onChange={(e) => onUpdate('cta_href', e.target.value)} />
                </div>
              </div>
              {value.cta_text && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 mb-1.5">{t.cta_display_mode ?? 'Button display'}</label>
                    <AnnouncementSelect
                      value={value.cta_display_mode ?? 'swap'}
                      onChange={(e) => onUpdate('cta_display_mode', e.target.value)}
                      options={[
                        { value: 'swap',   label: t.cta_display_swap   ?? 'Swap with text (animated)' },
                        { value: 'static', label: t.cta_display_static ?? 'Static (always visible)' },
                      ]}
                    />
                  </div>
                  {value.cta_display_mode !== 'static' && (
                    <div>
                      <label className="block text-xs font-medium text-zinc-600 mb-1.5">{t.cta_swap_seconds ?? 'Swap timing (s)'}</label>
                      <input type="number" min={1} max={30} value={value.cta_swap_seconds ?? 4}
                        onChange={(e) => onUpdate('cta_swap_seconds', Number(e.target.value))} className={inputCls} />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Style */}
          <div>
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">{t.style_label ?? 'Style'}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs text-zinc-600 mb-1.5">{t.bg_color ?? 'Background'}</label>
                <input type="color" value={value.bg_color || '#111111'} onChange={(e) => onUpdate('bg_color', e.target.value)} className="h-10 w-full rounded-lg border border-zinc-200 cursor-pointer" />
              </div>
              <div>
                <label className="block text-xs text-zinc-600 mb-1.5">{t.text_color ?? 'Text color'}</label>
                <input type="color" value={value.text_color || '#ffffff'} onChange={(e) => onUpdate('text_color', e.target.value)} className="h-10 w-full rounded-lg border border-zinc-200 cursor-pointer" />
              </div>
              <div>
                <label className="block text-xs text-zinc-600 mb-1.5">{t.font_size ?? 'Font size'}</label>
                <input type="number" min={10} max={24} value={value.font_size ?? 14} onChange={(e) => onUpdate('font_size', Number(e.target.value))} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-zinc-600 mb-1.5">{t.icon ?? 'Icon'}</label>
                <AnnouncementSelect
                  value={value.icon ?? ''}
                  onChange={(e) => onUpdate('icon', e.target.value || null)}
                  options={[{ value: '', label: '—' }, ...ICON_OPTIONS.map((ic) => ({ value: ic, label: ic }))]}
                />
              </div>
            </div>
          </div>

          {/* Behavior */}
          <div>
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">{t.behavior_label ?? 'Behavior'}</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-zinc-600 mb-1.5">{t.position ?? 'Position'}</label>
                <AnnouncementSelect
                  value={value.position}
                  onChange={(e) => onUpdate('position', e.target.value)}
                  options={[
                    { value: 'top', label: t.position_top ?? 'Top' },
                    { value: 'bottom', label: t.position_bottom ?? 'Bottom' },
                  ]}
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-600 mb-1.5">{t.behavior ?? 'Behavior'}</label>
                <AnnouncementSelect
                  value={value.behavior}
                  onChange={(e) => onUpdate('behavior', e.target.value)}
                  options={[
                    { value: 'sticky', label: t.behavior_sticky ?? 'Sticky' },
                    { value: 'static', label: t.behavior_static ?? 'Static' },
                  ]}
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-600 mb-1.5">{t.scope ?? 'Scope'}</label>
                <AnnouncementSelect
                  value={value.scope}
                  onChange={(e) => onUpdate('scope', e.target.value)}
                  options={[
                    { value: 'all', label: t.scope_all ?? 'All pages' },
                    { value: 'home', label: t.scope_home ?? 'Home only' },
                  ]}
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-600 mb-1.5">{t.rotation ?? 'Rotation (s)'}</label>
                <input type="number" min={2} max={120} value={value.rotation_seconds ?? 5} onChange={(e) => onUpdate('rotation_seconds', Number(e.target.value))} className={inputCls} />
              </div>
            </div>
          </div>

          {/* Schedule */}
          <div>
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">{t.schedule_label ?? 'Schedule'}</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-zinc-600 mb-1.5">{t.start_at ?? 'Start'}</label>
                <input type="datetime-local" value={isoToLocalInput(value.start_at)} onChange={(e) => onUpdate('start_at', localInputToIso(e.target.value))} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-zinc-600 mb-1.5">{t.end_at ?? 'End'}</label>
                <input type="datetime-local" value={isoToLocalInput(value.end_at)} onChange={(e) => onUpdate('end_at', localInputToIso(e.target.value))} className={inputCls} />
              </div>
            </div>
          </div>

          {/* Toggles */}
          <div>
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">{t.options_label ?? 'Options'}</p>
            <div className="flex flex-col gap-2">
              {[
                ['dismissible', t.dismissible ?? 'Dismissible'],
                ['icon_enabled', t.icon_enabled ?? 'Show icon'],
                ['border_enabled', t.border ?? 'Border'],
                ['carousel_enabled', t.carousel ?? 'Carousel rotate'],
              ].map(([field, label]) => (
                <label key={field} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-100 px-3 py-2.5 cursor-pointer hover:bg-zinc-50">
                  <span className="text-sm text-zinc-700">{label}</span>
                  <Toggle defaultChecked={!!value[field]} onChange={(v) => onUpdate(field, v)} />
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-zinc-100 px-5 py-3 sm:py-4 flex gap-3">
          <button onClick={handleClose} disabled={saving}
            className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 transition-colors">
            {t.cancel ?? 'Cancel'}
          </button>
          <button
            onClick={() => onSaveRow(handleClose)}
            disabled={saving}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 transition-colors">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? (t.saving ?? 'Saving…') : (t.save ?? 'Save')}
          </button>
        </div>
      </div>
    </>
  );

  return createPortal(content, document.body);
}

function AnnouncementsSection() {
  const dict = useDictionary();
  const t = dict?.admin?.settings?.announcements ?? {};
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawerSaving, setDrawerSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [editIdx, setEditIdx] = useState(null);
  const [draft, setDraft] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Use a ref (not state) so the close handler always reads the latest value.
  // The drawer closes asynchronously via setTimeout, so a stale state closure
  // would otherwise filter out an item that was just successfully saved.
  const discardOnCloseRef = useRef(false);

  useEffect(() => {
    fetch('/api/v1/admin/announcements')
      .then((r) => r.json())
      .then((json) => { if (json.success) setItems(json.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const updateDraft = (field, value) =>
    setDraft((prev) => prev ? { ...prev, [field]: value } : prev);

  const persist = async (nextItems) => {
    const res = await fetch('/api/v1/admin/announcements', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ announcements: nextItems }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error ?? 'Save failed');
    invalidateBarCache();
  };

  const openEdit = (idx) => {
    setDraft({ ...items[idx] });
    setEditIdx(idx);
    discardOnCloseRef.current = false;
  };

  const closeDrawer = () => {
    if (discardOnCloseRef.current && editIdx !== null) {
      // Discard the placeholder we appended on "add"
      setItems((prev) => prev.filter((_, i) => i !== editIdx));
    }
    discardOnCloseRef.current = false;
    setDraft(null);
    setEditIdx(null);
  };

  // Called from drawer Save button. Commits draft → items, then persists.
  const saveDraft = async (afterClose) => {
    if (draft === null || editIdx === null) return;
    const next = items.map((it, i) => (i === editIdx ? draft : it));
    setItems(next);
    setDrawerSaving(true);
    try {
      await persist(next);
      toast.success(t.saved ?? 'Announcement saved');
      discardOnCloseRef.current = false;
      afterClose?.();
    } catch (err) {
      toast.error(err.message ?? 'Failed to save');
    } finally {
      setDrawerSaving(false);
    }
  };

  const move = async (idx, dir) => {
    const next = [...items];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    next.forEach((it, i) => (it.priority = i));
    setItems(next);
    try { await persist(next); } catch (err) { toast.error(err.message); }
  };

  const toggleActive = async (idx, val) => {
    const next = items.map((it, i) => (i === idx ? { ...it, is_active: val } : it));
    setItems(next);
    try { await persist(next); } catch (err) { toast.error(err.message); }
  };

  const startAdd = () => setPickerOpen(true);

  const createOfType = (type) => {
    const newItem = { ...blankAnnouncement(type), priority: items.length };
    const newIdx = items.length;
    setItems((prev) => [...prev, newItem]);
    setDraft({ ...newItem });
    setEditIdx(newIdx);
    discardOnCloseRef.current = true;
  };

  const remove = async (idx) => {
    const next = items.filter((_, i) => i !== idx);
    setItems(next);
    setConfirmDelete(null);
    try { await persist(next); }
    catch (err) { toast.error(err.message); }
  };

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="h-20 rounded-2xl bg-zinc-100" />
        ))}
      </div>
    );
  }

  return (
    <>
      <SectionHeader
        title={t.title ?? 'Announcement Bars'}
        description={t.desc ?? 'Promotional banners shown across the storefront.'}
      />

      <div className="flex justify-end mb-4">
        <button
          type="button"
          onClick={startAdd}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          {t.add ?? 'Add Announcement'}
        </button>
      </div>

      <div className="flex flex-col gap-3 mb-5">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 rounded-2xl border border-dashed border-zinc-200 text-zinc-400">
            <Megaphone className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm font-medium text-zinc-500">{t.no_items ?? 'No announcements yet.'}</p>
            <p className="text-xs text-zinc-400 mt-1">{t.no_items_hint ?? 'Click “Add Announcement” to create your first banner.'}</p>
          </div>
        ) : (
          items.map((a, idx) => (
            <AnnouncementRow
              key={idx}
              value={a}
              t={t}
              isFirst={idx === 0}
              isLast={idx === items.length - 1}
              onMove={(dir) => move(idx, dir)}
              onToggle={(val) => toggleActive(idx, val)}
              onEdit={() => openEdit(idx)}
              onDelete={() => setConfirmDelete(idx)}
            />
          ))
        )}
      </div>

      <AnnouncementTypePicker
        open={pickerOpen}
        t={t}
        onPick={(type) => createOfType(type)}
        onClose={() => setPickerOpen(false)}
      />

      {editIdx !== null && draft !== null && (
        <AnnouncementDrawer
          value={draft}
          t={t}
          onUpdate={updateDraft}
          onClose={closeDrawer}
          onSaveRow={saveDraft}
          saving={drawerSaving}
        />
      )}

      <ConfirmationDialog
        isOpen={confirmDelete !== null}
        title={t.dialog_title ?? 'Delete Announcement'}
        description={t.dialog_desc ?? 'This action cannot be undone.'}
        confirmText={t.yes ?? 'Yes, delete'}
        cancelText={t.no ?? 'Cancel'}
        icon={<Trash2 className="h-5 w-5" />}
        onConfirm={() => remove(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
    </>
  );
}
