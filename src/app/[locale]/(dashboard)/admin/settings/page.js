"use client";

import { useState, useEffect, useRef, useCallback, useMemo, createContext, useContext } from "react";
import { useSearchParams } from "next/navigation";
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
  ShoppingCart,
  ExternalLink,
  Play,
  Film,
  LayoutGrid,
  Timer,
  AlignLeft,
  AlignCenter,
  AlignRight,
  LayoutTemplate,
  Smartphone,
  Home,
  Heart,
  User,
  Package,
  Menu as MenuIcon,
  Check,
  Mail,
  Share2,
  AlertTriangle,
  Search,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { invalidateBarCache, MarqueePreview, Countdown, SwapStack } from "@/components/shop/AnnouncementBar";
import { ANNOUNCEMENT_STYLE_PRESETS, resolveAnnouncementStyle, getPresetDefaultColors } from "@/lib/announcement-styles";
import { toast } from "sonner";
import { useDictionary } from "@/components/providers/LocaleProvider";
import { localeMetadata } from "@/i18n/config";
import { AdminSettingsSkeleton } from "@/components/skeletons";
import ConfirmationDialog from "@/components/ui/ConfirmationDialog";
import SectionsBuilder from "@/components/admin/product-sections/SectionsBuilder";
import { Blocks } from "lucide-react";
import { getMainImage } from "@/lib/product-image";
import ProductCard from "@/components/shop/ProductCard";
import LocationPicker from "@/components/admin/LocationPicker";
import { CARD_LAYOUTS } from "@/components/shop/ProductCard";
import {
  HEADER_CART_ICONS,
  HEADER_MENU_ICONS,
  SIDEBAR_THEMES,
  DEFAULT_HEADER_CART_ICON,
  DEFAULT_HEADER_MENU_ICON,
  DEFAULT_SIDEBAR_THEME,
} from "@/lib/storefront-ui";
import { registerNavGuard } from "@/lib/nav-guard";
import StripeConnectCard from "@/components/admin/StripeConnectCard";
import {
  SeoSearchPreview,
  SeoSocialPreview,
} from "@/components/admin/seo/SeoPreview";

const SECTION_DEFS = [
  { id: "general", icon: Store },
  { id: "storefront", icon: Layers },
  { id: "announcements", icon: Megaphone },
  { id: "product_sections", icon: Blocks },
  { id: "payments", icon: CreditCard },
  { id: "order_methods", icon: ShoppingCart },
  { id: "shipping", icon: Truck },
  { id: "notifications", icon: Bell },
  { id: "integrations", icon: Zap },
  { id: "seo", icon: Search },
  { id: "localization", icon: Globe },
];

export default function AdminSettingsPage() {
  const searchParams = useSearchParams();
  const initialTab = (() => {
    const t = searchParams.get("tab");
    return SECTION_DEFS.some((s) => s.id === t) ? t : "general";
  })();
  const [active, setActive] = useState(initialTab);
  const dict = useDictionary();
  const t = dict?.admin?.settings ?? {};
  const tSec = t.sections ?? {};
  const tUnsaved = t.unsaved ?? {};

  // Unsaved-changes guard. The mounted section registers its dirty flag + save
  // handler; navigation away is intercepted while there are pending edits.
  const dirtyRef = useRef(false);
  const saveRef = useRef(null);
  const pendingRef = useRef(null); // proceed() for the blocked action
  const [isDirty, setIsDirty] = useState(false);
  const [showLeave, setShowLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const register = useCallback((dirty, save) => {
    dirtyRef.current = dirty;
    saveRef.current = save;
    setIsDirty(dirty);
  }, []);

  const guard = useCallback((proceed) => {
    if (dirtyRef.current) {
      pendingRef.current = proceed;
      setShowLeave(true);
    } else {
      proceed();
    }
  }, []);

  const guardValue = useMemo(() => ({ register, guard }), [register, guard]);

  // Native prompt covers hard navigation: tab close, refresh, external links.
  useEffect(() => {
    if (!isDirty) return undefined;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // Intercept admin-shell navigation (sidebar links) while there are edits.
  useEffect(
    () =>
      registerNavGuard((proceed) => {
        if (!dirtyRef.current) return false;
        pendingRef.current = proceed;
        setShowLeave(true);
        return true;
      }),
    [],
  );

  const runPending = useCallback(() => {
    const proceed = pendingRef.current;
    pendingRef.current = null;
    setShowLeave(false);
    proceed?.();
  }, []);

  const cancelLeave = useCallback(() => {
    pendingRef.current = null;
    setShowLeave(false);
  }, []);

  const handleSaveLeave = useCallback(async () => {
    if (!saveRef.current) {
      runPending();
      return;
    }
    setLeaving(true);
    try {
      await saveRef.current();
      runPending();
    } catch (err) {
      toast.error(err?.message ?? 'Failed to save');
    } finally {
      setLeaving(false);
    }
  }, [runPending]);

  // Sync when the URL tab changes (e.g. when admin search navigates here).
  useEffect(() => {
    const next = searchParams.get("tab");
    if (next && SECTION_DEFS.some((s) => s.id === next) && next !== active) {
      setActive(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  if (!dict?.admin?.settings) return <AdminSettingsSkeleton />;

  return (
    <UnsavedChangesContext.Provider value={guardValue}>
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
                  onClick={() => {
                    if (s.id !== active) guard(() => setActive(s.id));
                  }}
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
        <section className="min-w-0 rounded-xl border border-zinc-100 bg-white p-6">
          {active === "general" && <GeneralSection />}
          {active === "storefront" && <StorefrontSection />}
          {active === "announcements" && <AnnouncementsSection />}
          {active === "product_sections" && <ProductSectionsSection />}
          {active === "payments" && <PaymentsSection />}
          {active === "order_methods" && <OrderMethodsSection />}
          {active === "shipping" && <ShippingSection />}
          {active === "notifications" && <NotificationsSection />}
          {active === "integrations" && <IntegrationsSection />}
          {active === "seo" && <SeoSection />}
          {active === "localization" && <LocalizationSection />}
        </section>
      </div>

      <UnsavedChangesDialog
        open={showLeave}
        t={tUnsaved}
        saving={leaving}
        onSave={handleSaveLeave}
        onDiscard={runPending}
        onCancel={cancelLeave}
      />
    </UnsavedChangesContext.Provider>
  );
}

function SectionSaveButton({ onSave, dirty }) {
  const [saving, setSaving] = useState(false);
  const dict = useDictionary();
  const label = dict?.admin?.settings?.save ?? 'Save changes';
  // When `dirty` is provided the button stays disabled until there are unsaved
  // changes; when omitted it behaves like a plain always-enabled save button.
  const dirtyAware = dirty !== undefined;

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
        disabled={saving || (dirtyAware && !dirty)}
        className="flex items-center gap-2 rounded-[5px] bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {saving ? (dict?.admin?.settings?.saving ?? 'Saving…') : label}
      </button>
    </div>
  );
}

/**
 * Shared loader/saver for the KV-backed settings sections. Loads the given
 * keys from /api/v1/settings once, tracks the working form plus its saved
 * baseline (so callers can show a dirty state), and persists via PATCH.
 *
 * @param {Record<string,string>} defaults - key → default value map.
 */
function useStoreSettings(defaults) {
  // Freeze the initial defaults once so later re-renders never reset the
  // saved baseline used for dirty detection.
  const [initial] = useState(() => defaults);
  const [form, setForm] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/v1/settings')
      .then((r) => r.json())
      .then(({ success, data }) => {
        if (cancelled || !success || !data) return;
        const next = { ...initial };
        for (const key of Object.keys(initial)) {
          if (data[key] !== undefined && data[key] !== '') next[key] = data[key];
        }
        setForm(next);
        setSaved(next);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [initial]);

  const setField = useCallback((key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const save = useCallback(async () => {
    const res = await fetch('/api/v1/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error ?? 'Failed to save');
    setSaved(form);
  }, [form]);

  const dirty = useMemo(
    () => Object.keys(initial).some((k) => form[k] !== saved[k]),
    [form, saved, initial],
  );

  useUnsavedGuard(dirty, save);

  return { form, setField, save, dirty, loading };
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

function SectionHeader({ title, description, icon }) {
  return (
    <div className="pb-4 mb-2 border-b border-zinc-100">
      <div className="flex items-center gap-2">
        {icon && (
          <span className="inline-flex shrink-0 items-center justify-center">
            {icon}
          </span>
        )}
        <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
      </div>
      <p className="text-sm text-zinc-500 mt-1">{description}</p>
    </div>
  );
}

// Lightweight sub-group divider used to cluster related fields inside a
// section (e.g. Identity / Branding / Contact within General).
function GroupHeader({ title, description, icon: Icon }) {
  return (
    <div className="pt-6 pb-2 mt-2 first:pt-0 first:mt-0">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 text-zinc-400" strokeWidth={1.75} />}
        <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
      </div>
      {description && <p className="text-xs text-zinc-500 mt-0.5">{description}</p>}
    </div>
  );
}

// ── Unsaved-changes guard ──────────────────────────────────────────────────
// The active section registers its dirty state + save handler here; the page
// shell uses it to intercept navigation and prompt before losing edits.
const UnsavedChangesContext = createContext(null);

/**
 * Called by a settings section to report unsaved edits and how to persist
 * them. Only the currently mounted section registers at any time.
 * @param {boolean} dirty
 * @param {() => Promise<void> | void} onSave
 */
function useUnsavedGuard(dirty, onSave) {
  const ctx = useContext(UnsavedChangesContext);
  const register = ctx?.register;
  const saveRef = useRef(onSave);
  useEffect(() => {
    saveRef.current = onSave;
  });
  useEffect(() => {
    if (!register) return undefined;
    register(dirty, () => saveRef.current?.());
    return () => register(false, null);
  }, [register, dirty]);
}

function UnsavedChangesDialog({ open, t, onSave, onDiscard, onCancel, saving }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape' && !saving) onCancel?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, saving, onCancel]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10100] flex items-center justify-center bg-black/50 px-4"
      onClick={saving ? undefined : onCancel}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col items-center gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-500">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <div className="text-center">
          <p className="font-semibold text-zinc-900 text-base">{t.title ?? 'Unsaved changes'}</p>
          <p className="mt-1 text-sm text-zinc-500">
            {t.desc ?? 'You have unsaved changes. Do you want to save them before leaving?'}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 pt-1">
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="w-full rounded-[5px] bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-75 inline-flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? (t.saving ?? 'Saving…') : (t.save ?? 'Save changes')}
          </button>
          <button
            type="button"
            onClick={onDiscard}
            disabled={saving}
            className="w-full rounded-xl border border-red-200 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            {t.discard ?? 'Discard changes'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="w-full rounded-xl py-2 text-sm font-medium text-zinc-500 hover:text-zinc-800 transition-colors disabled:opacity-50"
          >
            {t.cancel ?? 'Cancel'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function GeneralSection() {
  const t = useDictionary()?.admin?.settings?.general ?? {};
  const [form, setForm] = useState({
    store_name: '',
    store_description: '',
    store_logo: '',
    store_logo_dark: '',
    seo_favicon: '',
    contact_email: '',
    contact_phone: '',
    contact_whatsapp: '',
    contact_address: '',
    contact_lat: '',
    contact_lng: '',
    show_social_whatsapp: 'true',
    show_social_instagram: 'true',
    show_social_facebook: 'true',
    show_social_tiktok: 'true',
    social_whatsapp: '',
    social_instagram: '',
    social_facebook: '',
    social_tiktok: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedForm, setSavedForm] = useState(null);
  const [group, setGroup] = useState('identity');

  useEffect(() => {
    fetch('/api/v1/settings')
      .then((r) => r.json())
      .then(({ success, data }) => {
        if (success && data) {
          const next = {
            store_name: data.store_name ?? '',
            store_description: data.store_description ?? '',
            store_logo: data.store_logo ?? '',
            store_logo_dark: data.store_logo_dark ?? '',
            seo_favicon: data.seo_favicon ?? '',
            store_logo_size: data.store_logo_size ?? '160',
            store_logo_height: data.store_logo_height ?? '40',
            contact_email: data.contact_email ?? '',
            contact_phone: data.contact_phone ?? '',
            contact_whatsapp: data.contact_whatsapp ?? '',
            contact_address: data.contact_address ?? '',
            contact_lat: data.contact_lat ?? '',
            contact_lng: data.contact_lng ?? '',
            show_social_whatsapp: data.show_social_whatsapp ?? 'true',
            show_social_instagram: data.show_social_instagram ?? 'true',
            show_social_facebook: data.show_social_facebook ?? 'true',
            show_social_tiktok: data.show_social_tiktok ?? 'true',
            social_whatsapp: data.social_whatsapp ?? '',
            social_instagram: data.social_instagram ?? '',
            social_facebook: data.social_facebook ?? '',
            social_tiktok: data.social_tiktok ?? '',
          };
          setForm(next);
          setSavedForm(next);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (key) => (e) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleToggle = (key) => (val) =>
    setForm((prev) => ({ ...prev, [key]: String(val) }));

  const [uploadingLogo, setUploadingLogo] = useState({});

  const handleLogoUpload = async (e, key) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo((prev) => ({ ...prev, [key]: true }));
    try {
      const supabase = createClient();
      const ext = file.name.split('.').pop();
      const path = `store/logo-${key}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('hero-images').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from('hero-images').getPublicUrl(path);
      setForm((prev) => ({ ...prev, [key]: data.publicUrl }));
    } catch (err) {
      toast.error((t.upload_error ?? 'Upload failed') + ': ' + (err?.message ?? ''));
    } finally {
      setUploadingLogo((prev) => ({ ...prev, [key]: false }));
    }
  };

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
      setSavedForm(form);
      toast.success(t.saved ?? 'Settings saved');
    } catch (err) {
      toast.error(err?.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const dirty = savedForm ? JSON.stringify(form) !== JSON.stringify(savedForm) : false;
  useUnsavedGuard(dirty, handleSave);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[...Array(10)].map((_, i) => (
          <div key={i} className="h-10 rounded-lg bg-zinc-100" />
        ))}
      </div>
    );
  }

  const GROUPS = [
    { id: 'identity', label: t.group_identity ?? 'Store identity', icon: <Store className="h-4 w-4" /> },
    { id: 'branding', label: t.group_branding ?? 'Branding & logos', icon: <ImageIcon className="h-4 w-4" /> },
    { id: 'contact', label: t.group_contact ?? 'Contact', icon: <Mail className="h-4 w-4" /> },
    { id: 'social', label: t.social_title ?? 'Social Media', icon: <Share2 className="h-4 w-4" /> },
  ];

  return (
    <>
      <SectionHeader title={t.title} description={t.desc} />

      <div className="mb-5 flex flex-wrap gap-2">
        {GROUPS.map((g) => {
          const active = group === g.id;
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => setGroup(g.id)}
              className={`inline-flex items-center gap-2 rounded-[5px] border px-3.5 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'border-zinc-900 bg-zinc-900 text-white'
                  : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50'
              }`}
            >
              {g.icon}
              <span>{g.label}</span>
            </button>
          );
        })}
      </div>

      <div className="rounded-[5px] border border-zinc-200 bg-white p-5">
      {group === 'identity' && (
        <>
      <Field label={t.store_name} hint={t.store_name_hint}>
        <input
          className={inputClass}
          value={form.store_name}
          onChange={handleChange('store_name')}
          placeholder="My store"
        />
      </Field>
      <Field label={t.description} hint={t.description_hint}>
        <textarea
          rows={3}
          className={inputClass}
          value={form.store_description}
          onChange={handleChange('store_description')}
          placeholder={t.description_placeholder}
        />
      </Field>
        </>
      )}

      {group === 'branding' && (
        <>
      <Field label={t.store_logo ?? 'Store logo'} hint={t.store_logo_hint ?? 'Used in headers, footers, and emails. Upload a transparent PNG for best results.'}>
        <div className="flex flex-col sm:flex-row gap-4 items-start">
          <div className="flex h-20 items-center justify-center rounded-[5px] border border-zinc-200 bg-zinc-50" style={{ width: `${Math.min(Math.max(parseInt(form.store_logo_size || '160', 10) || 160, 80), 320)}px` }}>
            {form.store_logo ? (
              <img src={form.store_logo} alt="Store logo" className="max-h-full max-w-full object-contain p-2" style={{ maxHeight: `${Math.min(Math.max(parseInt(form.store_logo_height || '40', 10) || 40, 20), 120)}px` }} />
            ) : (
              <span className="text-xs text-zinc-400">{t.no_logo ?? 'No logo'}</span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-[5px] border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
              <Loader2 className={`h-4 w-4 ${uploadingLogo.store_logo ? 'animate-spin' : 'hidden'}`} />
              <span>{uploadingLogo.store_logo ? (t.uploading ?? 'Uploading…') : (t.upload_logo ?? 'Upload logo')}</span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleLogoUpload(e, 'store_logo')} />
            </label>
            {form.store_logo && (
              <button
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, store_logo: '' }))}
                className="text-xs text-red-600 hover:text-red-700 text-left"
              >
                {t.remove_logo ?? 'Remove logo'}
              </button>
            )}
          </div>
        </div>
      </Field>
      <Field label={t.store_logo_dark ?? 'Store logo (dark version)'} hint={t.store_logo_dark_hint ?? 'Used on dark backgrounds like the footer. Upload a white/light version.'}>
        <div className="flex flex-col sm:flex-row gap-4 items-start">
          <div className="flex h-20 items-center justify-center rounded-[5px] border border-zinc-200 bg-zinc-900" style={{ width: `${Math.min(Math.max(parseInt(form.store_logo_size || '160', 10) || 160, 80), 320)}px` }}>
            {form.store_logo_dark ? (
              <img src={form.store_logo_dark} alt="Store logo dark" className="max-h-full max-w-full object-contain p-2" style={{ maxHeight: `${Math.min(Math.max(parseInt(form.store_logo_height || '40', 10) || 40, 20), 120)}px` }} />
            ) : (
              <span className="text-xs text-zinc-500">{t.no_logo_dark ?? 'No dark logo'}</span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-[5px] border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
              <Loader2 className={`h-4 w-4 ${uploadingLogo.store_logo_dark ? 'animate-spin' : 'hidden'}`} />
              <span>{uploadingLogo.store_logo_dark ? (t.uploading ?? 'Uploading…') : (t.upload_logo_dark ?? 'Upload dark logo')}</span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleLogoUpload(e, 'store_logo_dark')} />
            </label>
            {form.store_logo_dark && (
              <button
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, store_logo_dark: '' }))}
                className="text-xs text-red-600 hover:text-red-700 text-left"
              >
                {t.remove_logo ?? 'Remove logo'}
              </button>
            )}
          </div>
        </div>
      </Field>
      <Field label={t.favicon ?? 'Favicon'} hint={t.favicon_hint ?? 'Small icon shown in browser tabs and search results. Also used as the SEO favicon. Square PNG/ICO/SVG recommended.'}>
        <div className="flex flex-col sm:flex-row gap-4 items-start">
          <div className="flex h-16 w-16 items-center justify-center rounded-[5px] border border-zinc-200 bg-zinc-50">
            {form.seo_favicon ? (
              <img src={form.seo_favicon} alt="Favicon" className="max-h-full max-w-full object-contain p-2" />
            ) : (
              <span className="text-[10px] text-zinc-400">{t.no_favicon ?? 'None'}</span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-[5px] border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
              <Loader2 className={`h-4 w-4 ${uploadingLogo.seo_favicon ? 'animate-spin' : 'hidden'}`} />
              <span>{uploadingLogo.seo_favicon ? (t.uploading ?? 'Uploading…') : (t.upload_favicon ?? 'Upload favicon')}</span>
              <input type="file" accept="image/png,image/x-icon,image/vnd.microsoft.icon,image/svg+xml,.ico" className="hidden" onChange={(e) => handleLogoUpload(e, 'seo_favicon')} />
            </label>
            {form.seo_favicon && (
              <button
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, seo_favicon: '' }))}
                className="text-xs text-red-600 hover:text-red-700 text-left"
              >
                {t.remove_favicon ?? 'Remove favicon'}
              </button>
            )}
          </div>
        </div>
      </Field>
      <Field label={t.logo_width ?? 'Logo width'} hint={t.logo_width_hint ?? 'Preview width in pixels (80-320).'}>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={80}
            max={320}
            value={form.store_logo_size}
            onChange={handleChange('store_logo_size')}
            className="flex-1 accent-blue-600"
          />
          <input
            type="number"
            min={80}
            max={320}
            value={form.store_logo_size}
            onChange={handleChange('store_logo_size')}
            className={`${inputClass} w-24 text-center`}
          />
        </div>
      </Field>
      <Field label={t.logo_height ?? 'Logo height'} hint={t.logo_height_hint ?? 'Maximum height in pixels (20-120).'}>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={20}
            max={120}
            value={form.store_logo_height}
            onChange={handleChange('store_logo_height')}
            className="flex-1 accent-blue-600"
          />
          <input
            type="number"
            min={20}
            max={120}
            value={form.store_logo_height}
            onChange={handleChange('store_logo_height')}
            className={`${inputClass} w-24 text-center`}
          />
        </div>
      </Field>
        </>
      )}

      {group === 'contact' && (
        <>
      <Field label={t.contact_email} hint={t.contact_email_hint}>
        <input
          type="email"
          className={inputClass}
          value={form.contact_email}
          onChange={handleChange('contact_email')}
          placeholder="hello@mystore.com"
        />
      </Field>
      <Field label={t.contact_phone} hint={t.contact_phone_hint}>
        <input
          type="tel"
          className={inputClass}
          value={form.contact_phone}
          onChange={handleChange('contact_phone')}
          placeholder="+212 600 000 000"
        />
      </Field>
      <Field label={t.contact_whatsapp} hint={t.contact_whatsapp_hint}>
        <input
          type="tel"
          className={inputClass}
          value={form.contact_whatsapp}
          onChange={handleChange('contact_whatsapp')}
          placeholder="212600000000"
        />
      </Field>
      <Field label={t.contact_address} hint={t.contact_address_hint}>
        <textarea
          rows={3}
          className={inputClass}
          value={form.contact_address}
          onChange={handleChange('contact_address')}
          placeholder="123 Main Street, City, Country"
        />
      </Field>
      <Field label={t.store_location ?? 'Store location'} hint={t.store_location_hint ?? 'Pick the exact spot shown on the contact page map.'}>
        <LocationPicker
          lat={form.contact_lat}
          lng={form.contact_lng}
          dict={t}
          onChange={(la, ln) =>
            setForm((prev) => ({
              ...prev,
              contact_lat: la == null ? '' : String(la),
              contact_lng: ln == null ? '' : String(ln),
            }))
          }
        />
      </Field>
        </>
      )}

      {group === 'social' && (
        <>
      <div className="py-4 border-b border-zinc-100">
        <div className="space-y-3">
          {[
            {
              key: 'whatsapp',
              icon: (
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.117.549 4.103 1.508 5.829L.057 23.5l5.802-1.429A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.848 0-3.576-.5-5.065-1.373l-.363-.214-3.441.847.873-3.348-.236-.386A9.953 9.953 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                </svg>
              ),
            },
            {
              key: 'instagram',
              icon: (
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                </svg>
              ),
            },
            {
              key: 'facebook',
              icon: (
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              ),
            },
            {
              key: 'tiktok',
              icon: (
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                  <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
                </svg>
              ),
            },
          ].map(({ key, icon }) => (
            <div key={key} className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[5px] bg-zinc-100 text-zinc-600">
                {icon}
              </div>
              <input
                className={`${inputClass} flex-1 min-w-0`}
                value={form[`social_${key}`]}
                onChange={handleChange(`social_${key}`)}
                placeholder={t[`social_${key}_placeholder`] ?? `${key.charAt(0).toUpperCase() + key.slice(1)} handle`}
              />
              <Toggle
                checked={form[`show_social_${key}`] === 'true'}
                onChange={handleToggle(`show_social_${key}`)}
                aria-label={t[`show_social_${key}`] ?? `Show ${key}`}
              />
            </div>
          ))}
        </div>
      </div>
        </>
      )}
      </div>

      <div className="pt-4 mt-2 border-t border-zinc-100 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-[5px] bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? (t.saving ?? 'Saving…') : (t.save ?? 'Save changes')}
        </button>
      </div>
    </>
  );
}

function PaymentsSection() {
  const t = useDictionary()?.admin?.settings?.payments ?? {};
  const { form, setField, save, dirty, loading } = useStoreSettings({
    payments_currency: 'MAD',
    payments_cod_enabled: 'true',
  });

  if (loading) return <AdminSettingsSkeleton />;

  return (
    <>
      <SectionHeader title={t.title} description={t.desc} />

      {/* Base currency */}
      <div className="mt-2 rounded-[5px] border border-zinc-200 bg-white">
        <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-sm">
            <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
              {t.storefront_group ?? 'Storefront'}
            </p>
            <h3 className="mt-1 text-sm font-semibold tracking-tight text-zinc-900">{t.currency}</h3>
            <p className="mt-0.5 text-[13px] text-zinc-500">
              {t.currency_hint ?? 'Base currency used across the storefront.'}
            </p>
          </div>
          <select
            className="w-full rounded-[5px] border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 sm:w-64"
            value={form.payments_currency}
            onChange={(e) => setField('payments_currency', e.target.value)}
          >
            <option value="MAD">MAD — Moroccan Dirham</option>
            <option value="USD">USD — US Dollar</option>
            <option value="EUR">EUR — Euro</option>
          </select>
        </div>
      </div>

      {/* Card payments provider */}
      <p className="mb-3 mt-6 text-[11px] font-medium uppercase tracking-wider text-zinc-400">
        {t.methods ?? 'Payment methods'}
      </p>
      <div className="space-y-3">
        <StripeConnectCard />
      </div>

      <SectionSaveButton onSave={save} dirty={dirty} />
    </>
  );
}

function MethodCard({ icon, iconClass, title, desc, enabled, onToggle, t, children }) {
  return (
    <div className="rounded-[5px] border border-zinc-200 bg-white">
      <div className="flex items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-3">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[5px] ${iconClass}`}>
            {icon}
          </div>
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-zinc-900">{title}</h3>
            <p className="mt-0.5 text-[13px] text-zinc-500">{desc}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`hidden rounded-[5px] px-2 py-1 text-[11px] font-medium sm:inline ${
              enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-500'
            }`}
          >
            {enabled ? (t.enabled ?? 'Enabled') : (t.disabled ?? 'Disabled')}
          </span>
          <Toggle checked={enabled} onChange={onToggle} />
        </div>
      </div>
      {children}
    </div>
  );
}

function WhatsAppGlyph() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-[18px] w-[18px]">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.117 1.524 5.847L.057 23.012a.75.75 0 00.931.931l5.165-1.467A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75a9.73 9.73 0 01-4.964-1.356l-.355-.212-3.668 1.042 1.042-3.668-.212-.355A9.73 9.73 0 012.25 12C2.25 6.615 6.615 2.25 12 2.25S21.75 6.615 21.75 12 17.385 21.75 12 21.75z"/>
    </svg>
  );
}

function OrderMethodsSection() {
  const t = useDictionary()?.admin?.settings?.order_methods ?? {};
  const { form, setField, save, dirty, loading } = useStoreSettings({
    payments_cod_enabled: 'true',
    order_whatsapp_enabled: 'false',
    order_whatsapp_number: '',
    order_whatsapp_all_countries: 'false',
    order_online_enabled: 'true',
  });

  if (loading) return <AdminSettingsSkeleton />;

  const codOn = form.payments_cod_enabled === 'true';
  const waOn = form.order_whatsapp_enabled === 'true';
  const onlineOn = form.order_online_enabled === 'true';

  return (
    <>
      <SectionHeader title={t.title} description={t.desc} />
      <div className="mt-2 space-y-3">
        {/* Normal order — cash on delivery */}
        <MethodCard
          icon={<Truck className="h-[18px] w-[18px]" />}
          iconClass="bg-zinc-100 text-zinc-600"
          title={t.cod_title ?? 'Normal Order (Cash on Delivery)'}
          desc={t.cod_desc ?? 'Customer pays in cash when the order is delivered.'}
          enabled={codOn}
          onToggle={(v) => setField('payments_cod_enabled', String(v))}
          t={t}
        />

        {/* Order via WhatsApp */}
        <MethodCard
          icon={<WhatsAppGlyph />}
          iconClass="bg-[#25D366]/10 text-[#25D366]"
          title={t.whatsapp_title ?? 'Order via WhatsApp'}
          desc={t.whatsapp_desc ?? 'Customer sends the order to your WhatsApp to finalize manually.'}
          enabled={waOn}
          onToggle={(v) => setField('order_whatsapp_enabled', String(v))}
          t={t}
        >
          {waOn && (
            <div className="space-y-4 border-t border-zinc-100 px-5 py-4">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-6">
                <div>
                  <label className="text-sm font-medium text-zinc-900">
                    {t.whatsapp_number ?? 'WhatsApp number'}
                  </label>
                  <p className="mt-1 text-xs text-zinc-500">
                    {t.whatsapp_number_hint ?? 'International format, digits only (e.g. 2126XXXXXXXX).'}
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <input
                    className="w-full rounded-[5px] border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    inputMode="numeric"
                    placeholder="2126XXXXXXXX"
                    value={form.order_whatsapp_number}
                    onChange={(e) => setField('order_whatsapp_number', e.target.value.replace(/[^0-9]/g, ''))}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-zinc-900">
                    {t.whatsapp_all_countries ?? 'Show for all countries'}
                  </p>
                  <p className="mt-0.5 text-[13px] text-zinc-500">
                    {t.whatsapp_all_countries_hint ?? 'When off, WhatsApp ordering is shown only to customers in Morocco.'}
                  </p>
                </div>
                <Toggle
                  checked={form.order_whatsapp_all_countries === 'true'}
                  onChange={(v) => setField('order_whatsapp_all_countries', String(v))}
                />
              </div>
            </div>
          )}
        </MethodCard>

        {/* Online payment (Stripe / providers) */}
        <MethodCard
          icon={<CreditCard className="h-[18px] w-[18px]" />}
          iconClass="bg-[#635bff]/10 text-[#635bff]"
          title={t.online_title ?? 'Online Payment'}
          desc={t.online_desc ?? 'Accept card payments online through Stripe.'}
          enabled={onlineOn}
          onToggle={(v) => setField('order_online_enabled', String(v))}
          t={t}
        >
          {onlineOn && (
            <div className="border-t border-zinc-100 px-5 py-4">
              <p className="text-[13px] text-zinc-500">
                {t.online_config_hint ?? 'Connect and manage your Stripe account in the Payments tab.'}
              </p>
              <a
                href="?tab=payments"
                className="mt-3 inline-flex items-center gap-2 rounded-[5px] border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50"
              >
                <CreditCard className="h-4 w-4" />
                {t.online_configure ?? 'Configure Stripe'}
              </a>
            </div>
          )}
        </MethodCard>
      </div>

      <SectionSaveButton onSave={save} dirty={dirty} />
    </>
  );
}

function ShippingSection() {
  const t = useDictionary()?.admin?.settings?.shipping ?? {};
  const { form, setField, save, dirty, loading } = useStoreSettings({
    shipping_origin: 'Morocco',
    shipping_flat_rate: '',
    shipping_free_threshold: '',
  });

  const handleNumber = (key) => (e) =>
    setField(key, e.target.value.replace(/[^0-9.]/g, ''));

  if (loading) return <AdminSettingsSkeleton />;

  return (
    <>
      <SectionHeader title={t.title} description={t.desc} />
      <Field label={t.origin}>
        <input
          className={inputClass}
          value={form.shipping_origin}
          onChange={(e) => setField('shipping_origin', e.target.value)}
          placeholder="Morocco"
        />
      </Field>
      <Field label={t.flat} hint={t.flat_hint}>
        <input
          className={inputClass}
          inputMode="decimal"
          value={form.shipping_flat_rate}
          onChange={handleNumber('shipping_flat_rate')}
          placeholder="5.00"
        />
      </Field>
      <Field label={t.free_threshold} hint={t.free_threshold_hint ?? 'Orders at or above this amount ship free. Leave empty to disable.'}>
        <input
          className={inputClass}
          inputMode="decimal"
          value={form.shipping_free_threshold}
          onChange={handleNumber('shipping_free_threshold')}
          placeholder="100.00"
        />
      </Field>
      <SectionSaveButton onSave={save} dirty={dirty} />
    </>
  );
}

function NotificationsSection() {
  const t = useDictionary()?.admin?.settings?.notifications ?? {};
  const [form, setForm] = useState({
    notify_new_order: 'true',
    notify_order_cancelled: 'true',
    notify_low_stock: 'true',
    notify_out_of_stock: 'true',
    notify_low_stock_threshold: '5',
    telegram_notifications_enabled: 'false',
    telegram_notify_new_order: 'true',
    telegram_notify_order_cancelled: 'true',
    telegram_notify_low_stock: 'true',
    telegram_notify_out_of_stock: 'true',
    whatsapp_notifications_enabled: 'false',
    whatsapp_notify_created: 'true',
    whatsapp_notify_confirmed: 'true',
    whatsapp_notify_processing: 'true',
    whatsapp_notify_shipped: 'true',
    whatsapp_notify_delivered: 'true',
    whatsapp_notify_cancelled: 'true',
    whatsapp_notify_invoice_ready: 'true',
  });
  const [loading, setLoading] = useState(true);
  const [savedForm, setSavedForm] = useState(null);

  useEffect(() => {
    fetch('/api/v1/settings')
      .then((r) => r.json())
      .then(({ success, data }) => {
        if (success && data) {
          const next = {
            notify_new_order: data.notify_new_order ?? 'true',
            notify_order_cancelled: data.notify_order_cancelled ?? 'true',
            notify_low_stock: data.notify_low_stock ?? 'true',
            notify_out_of_stock: data.notify_out_of_stock ?? 'true',
            notify_low_stock_threshold: data.notify_low_stock_threshold ?? '5',
            telegram_notifications_enabled: data.telegram_notifications_enabled ?? 'false',
            telegram_notify_new_order: data.telegram_notify_new_order ?? 'true',
            telegram_notify_order_cancelled: data.telegram_notify_order_cancelled ?? 'true',
            telegram_notify_low_stock: data.telegram_notify_low_stock ?? 'true',
            telegram_notify_out_of_stock: data.telegram_notify_out_of_stock ?? 'true',
            whatsapp_notifications_enabled: data.whatsapp_notifications_enabled ?? 'false',
            whatsapp_notify_created: data.whatsapp_notify_created ?? 'true',
            whatsapp_notify_confirmed: data.whatsapp_notify_confirmed ?? 'true',
            whatsapp_notify_processing: data.whatsapp_notify_processing ?? 'true',
            whatsapp_notify_shipped: data.whatsapp_notify_shipped ?? 'true',
            whatsapp_notify_delivered: data.whatsapp_notify_delivered ?? 'true',
            whatsapp_notify_cancelled: data.whatsapp_notify_cancelled ?? 'true',
            whatsapp_notify_invoice_ready: data.whatsapp_notify_invoice_ready ?? 'true',
          };
          setForm(next);
          setSavedForm(next);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = (key) => (val) =>
    setForm((prev) => ({ ...prev, [key]: String(val) }));

  const handleThreshold = (e) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    setForm((prev) => ({ ...prev, notify_low_stock_threshold: value }));
  };

  const handleSave = async () => {
    const payload = {
      notify_new_order: form.notify_new_order,
      notify_order_cancelled: form.notify_order_cancelled,
      notify_low_stock: form.notify_low_stock,
      notify_out_of_stock: form.notify_out_of_stock,
      notify_low_stock_threshold: String(Math.max(1, parseInt(form.notify_low_stock_threshold || '5', 10) || 5)),
      telegram_notifications_enabled: form.telegram_notifications_enabled,
      telegram_notify_new_order: form.telegram_notify_new_order,
      telegram_notify_order_cancelled: form.telegram_notify_order_cancelled,
      telegram_notify_low_stock: form.telegram_notify_low_stock,
      telegram_notify_out_of_stock: form.telegram_notify_out_of_stock,
      // whatsapp_notifications_enabled is owned by the Integrations tab; not
      // written here so the two screens don't overwrite each other.
      whatsapp_notify_created: form.whatsapp_notify_created,
      whatsapp_notify_confirmed: form.whatsapp_notify_confirmed,
      whatsapp_notify_processing: form.whatsapp_notify_processing,
      whatsapp_notify_shipped: form.whatsapp_notify_shipped,
      whatsapp_notify_delivered: form.whatsapp_notify_delivered,
      whatsapp_notify_cancelled: form.whatsapp_notify_cancelled,
      whatsapp_notify_invoice_ready: form.whatsapp_notify_invoice_ready,
    };

    const res = await fetch('/api/v1/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to save');
    setSavedForm(form);
  };

  const dirty = savedForm ? JSON.stringify(form) !== JSON.stringify(savedForm) : false;
  useUnsavedGuard(dirty, handleSave);

  const [group, setGroup] = useState('admin');
  const telegramEnabled = form.telegram_notifications_enabled === 'true';
  const whatsappEnabled = form.whatsapp_notifications_enabled === 'true';

  if (loading) return <AdminSettingsSkeleton />;

  const TelegramIcon = (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-blue-500" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.941z"/>
    </svg>
  );
  const WhatsAppIcon = (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-green-500" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
  const GROUPS = [
    { id: 'admin', label: t.tab_admin ?? 'Admin', icon: <Bell className="h-4 w-4" />, on: true },
    { id: 'telegram', label: t.tab_telegram ?? 'Telegram', icon: TelegramIcon, on: telegramEnabled },
    { id: 'whatsapp', label: t.tab_whatsapp ?? 'WhatsApp', icon: WhatsAppIcon, on: whatsappEnabled },
  ];

  return (
    <>
      <SectionHeader title={t.title} description={t.desc} />

      <div className="mb-5 flex flex-wrap gap-2">
        {GROUPS.map((g) => {
          const active = group === g.id;
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => setGroup(g.id)}
              className={`inline-flex items-center gap-2 rounded-[5px] border px-3.5 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'border-zinc-900 bg-zinc-900 text-white'
                  : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50'
              }`}
            >
              {g.icon}
              <span>{g.label}</span>
              <span className={`h-1.5 w-1.5 rounded-full ${g.on ? 'bg-green-500' : active ? 'bg-white/40' : 'bg-zinc-300'}`} />
            </button>
          );
        })}
      </div>

      <div className="rounded-[5px] border border-zinc-200 bg-white p-5">
      {group === 'admin' && (
        <>
      <Field label={t.new_order}>
        <Toggle
          checked={form.notify_new_order === 'true'}
          onChange={handleToggle('notify_new_order')}
        />
      </Field>
      <Field label={t.order_cancelled}>
        <Toggle
          checked={form.notify_order_cancelled === 'true'}
          onChange={handleToggle('notify_order_cancelled')}
        />
      </Field>
      <Field label={t.low_stock}>
        <Toggle
          checked={form.notify_low_stock === 'true'}
          onChange={handleToggle('notify_low_stock')}
        />
      </Field>
      <Field label={t.out_of_stock}>
        <Toggle
          checked={form.notify_out_of_stock === 'true'}
          onChange={handleToggle('notify_out_of_stock')}
        />
      </Field>
      <Field label={t.low_stock_threshold} hint={t.low_stock_threshold_hint}>
        <input
          type="number"
          min={1}
          value={form.notify_low_stock_threshold}
          onChange={handleThreshold}
          className={inputClass}
        />
      </Field>
        </>
      )}

      {group === 'telegram' && (
        <>
      <p className="mb-4 text-xs text-zinc-500">
        {t.telegram_credentials_hint ?? "Bot token and chat ID are configured under the Integrations tab."}
      </p>
      <Field label={t.telegram_enabled ?? "Enable Telegram notifications"}>
        <Toggle
          checked={telegramEnabled}
          onChange={handleToggle('telegram_notifications_enabled')}
        />
      </Field>
      <Field label={t.telegram_new_order ?? "New order"}>
        <Toggle
          checked={form.telegram_notify_new_order === 'true'}
          onChange={handleToggle('telegram_notify_new_order')}
          disabled={!telegramEnabled}
        />
      </Field>
      <Field label={t.telegram_order_cancelled ?? "Order cancelled"}>
        <Toggle
          checked={form.telegram_notify_order_cancelled === 'true'}
          onChange={handleToggle('telegram_notify_order_cancelled')}
          disabled={!telegramEnabled}
        />
      </Field>
      <Field label={t.telegram_low_stock ?? "Low stock alerts"}>
        <Toggle
          checked={form.telegram_notify_low_stock === 'true'}
          onChange={handleToggle('telegram_notify_low_stock')}
          disabled={!telegramEnabled}
        />
      </Field>
      <Field label={t.telegram_out_of_stock ?? "Out of stock alerts"}>
        <Toggle
          checked={form.telegram_notify_out_of_stock === 'true'}
          onChange={handleToggle('telegram_notify_out_of_stock')}
          disabled={!telegramEnabled}
        />
      </Field>
        </>
      )}

      {group === 'whatsapp' && (
        <>
      <p className="mb-4 text-xs text-zinc-500">
        {t.whatsapp_credentials_hint ?? "Enable WhatsApp and set credentials under the Integrations tab."}
      </p>
      <Field label={t.whatsapp_created ?? "Order placed"}>
        <Toggle
          checked={form.whatsapp_notify_created === 'true'}
          onChange={handleToggle('whatsapp_notify_created')}
          disabled={!whatsappEnabled}
        />
      </Field>
      <Field label={t.whatsapp_confirmed ?? "Order confirmed"}>
        <Toggle
          checked={form.whatsapp_notify_confirmed === 'true'}
          onChange={handleToggle('whatsapp_notify_confirmed')}
          disabled={!whatsappEnabled}
        />
      </Field>
      <Field label={t.whatsapp_processing ?? "Order processing"}>
        <Toggle
          checked={form.whatsapp_notify_processing === 'true'}
          onChange={handleToggle('whatsapp_notify_processing')}
          disabled={!whatsappEnabled}
        />
      </Field>
      <Field label={t.whatsapp_shipped ?? "Order shipped"}>
        <Toggle
          checked={form.whatsapp_notify_shipped === 'true'}
          onChange={handleToggle('whatsapp_notify_shipped')}
          disabled={!whatsappEnabled}
        />
      </Field>
      <Field label={t.whatsapp_delivered ?? "Order delivered"}>
        <Toggle
          checked={form.whatsapp_notify_delivered === 'true'}
          onChange={handleToggle('whatsapp_notify_delivered')}
          disabled={!whatsappEnabled}
        />
      </Field>
      <Field label={t.whatsapp_cancelled ?? "Order cancelled"}>
        <Toggle
          checked={form.whatsapp_notify_cancelled === 'true'}
          onChange={handleToggle('whatsapp_notify_cancelled')}
          disabled={!whatsappEnabled}
        />
      </Field>
      <Field label={t.whatsapp_invoice_ready ?? "Invoice ready"}>
        <Toggle
          checked={form.whatsapp_notify_invoice_ready === 'true'}
          onChange={handleToggle('whatsapp_notify_invoice_ready')}
          disabled={!whatsappEnabled}
        />
      </Field>
        </>
      )}
      </div>

      <SectionSaveButton onSave={handleSave} />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Button Display — rebuilt from scratch (flat block layout, no nested flex,
// no fragment-in-conditional patterns, native color input rendered inline).
// ─────────────────────────────────────────────────────────────────────────────

const BUTTON_STYLE_OPTIONS = [
  { value: 'add_to_cart',      label: 'Add to Cart',      description: 'Single "Add to Cart" button' },
  { value: 'shop_now',         label: 'Shop Now',         description: 'Single "Shop Now" link to product page' },
  { value: 'horizontal_style1',label: 'Horizontal — icon',description: '"Shop Now" text + cart icon button side-by-side' },
  { value: 'horizontal_style2',label: 'Horizontal — text',description: '"Shop Now" + "Add to Cart" equal halves' },
  { value: 'vertical',         label: 'Vertical',         description: '"Shop Now" above "Add to Cart" stacked' },
];

function StyleThumb() { return null; }

// Legacy ColorRow kept as a no-op shim in case any future ref is added.
function ColorRow() { return null; }

// Storefront wrapper — combines the Hero carousel and the Product-Card display
// settings under a single sidebar entry, with two inner tabs.
function StorefrontSection() {
  const t = useDictionary()?.admin?.settings ?? {};
  const tabs = t.storefront_tabs ?? {};
  const searchParams = useSearchParams();
  const VALID_SUBS = ['hero', 'header', 'mobile_nav', 'display', 'layout', 'carousel'];
  const initialSub = (() => {
    const s = searchParams.get('sub');
    return VALID_SUBS.includes(s) ? s : 'hero';
  })();
  const [tab, setTab] = useState(initialSub);
  const guard = useContext(UnsavedChangesContext)?.guard;

  // Sync when the URL sub-tab changes (e.g. via admin search deep-link).
  useEffect(() => {
    const next = searchParams.get('sub');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (next && VALID_SUBS.includes(next) && next !== tab) setTab(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const TAB_ITEMS = [
    { key: 'hero',       label: tabs.hero       ?? 'Hero Carousel',    Icon: Film },
    { key: 'header',     label: tabs.header     ?? 'Header & Sidebar', Icon: LayoutTemplate },
    { key: 'mobile_nav', label: tabs.mobile_nav ?? 'Mobile Nav',       Icon: Smartphone },
    { key: 'display',    label: tabs.display    ?? 'Button Display',   Icon: ShoppingCart },
    { key: 'layout',     label: tabs.layout     ?? 'Card Layout',      Icon: LayoutGrid },
    { key: 'carousel',   label: tabs.carousel   ?? 'Carousel',         Icon: Blocks },
  ];

  return (
    <>
      {/* Segmented tab bar — icons + full labels, wraps onto multiple rows when needed */}
      <div
        role="tablist"
        aria-label="Storefront Tabs"
        className="mb-6 flex flex-wrap gap-2"
      >
        {TAB_ITEMS.map(({ key, label, Icon }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                if (key === tab) return;
                if (guard) guard(() => setTab(key));
                else setTab(key);
              }}
              className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-medium transition-all duration-200 border ${
                active
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-600/25'
                  : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300 hover:text-zinc-900 hover:bg-zinc-50'
              }`}
            >
              <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-white' : 'text-zinc-400'}`} strokeWidth={1.75} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {tab === 'hero' && <HeroSection />}
      {tab === 'header' && <HeaderSidebarSection />}
      {tab === 'mobile_nav' && <MobileNavSection />}
      {tab === 'display' && <DisplaySection />}
      {tab === 'layout' && <LayoutSection />}
      {tab === 'carousel' && <CarouselSection />}
    </>
  );
}

// ── Header & Sidebar customization ─────────────────────────────────────────
// Pickers for the storefront header cart icon, drawer-open icon, and the
// active sidebar drawer theme. All three settings are stored as plain string
// keys resolved by src/lib/storefront-ui.js.
function HeaderSidebarSection() {
  const t = useDictionary()?.admin?.settings?.header_sidebar ?? {};
  const [cartIcon, setCartIcon] = useState(DEFAULT_HEADER_CART_ICON);
  const [menuIcon, setMenuIcon] = useState(DEFAULT_HEADER_MENU_ICON);
  const [theme, setTheme] = useState(DEFAULT_SIDEBAR_THEME);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/v1/settings')
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data) {
          setCartIcon(json.data.header_cart_icon ?? DEFAULT_HEADER_CART_ICON);
          setMenuIcon(json.data.header_menu_icon ?? DEFAULT_HEADER_MENU_ICON);
          setTheme(json.data.sidebar_theme ?? DEFAULT_SIDEBAR_THEME);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/v1/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          header_cart_icon: cartIcon,
          header_menu_icon: menuIcon,
          sidebar_theme: theme,
        }),
      });
      const json = await res.json();
      if (json.success) toast.success(t.saved ?? 'Header & sidebar saved');
      else toast.error(json.error ?? 'Save failed');
    } catch {
      toast.error('Network error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-zinc-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <SectionHeader
        title={t.title ?? 'Header & Sidebar'}
        description={t.description ?? 'Choose the icons displayed in the storefront header and the color theme applied to the sidebar drawer.'}
        icon={<LayoutTemplate className="h-5 w-5 text-blue-600" />}
      />

      {/* Cart icon picker */}
      <div>
        <h3 className="text-sm font-semibold text-zinc-800">{t.cart_icon ?? 'Cart button icon'}</h3>
        <p className="text-xs text-zinc-500 mt-0.5">{t.cart_icon_desc ?? 'Shown in the header next to the cart count.'}</p>
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(HEADER_CART_ICONS).map(([key, { label, Icon }]) => {
            const active = cartIcon === key;
            const displayLabel = t.cart_icons?.[key] ?? label;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setCartIcon(key)}
                className={`flex flex-col items-center justify-center gap-2 rounded-xl border p-4 transition-all ${
                  active
                    ? 'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500'
                    : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300'
                }`}
                aria-pressed={active}
              >
                <Icon className="h-7 w-7" strokeWidth={1.5} />
                <span className="text-xs font-medium text-center">{displayLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Menu icon picker */}
      <div>
        <h3 className="text-sm font-semibold text-zinc-800">{t.menu_icon ?? 'Sidebar open button icon'}</h3>
        <p className="text-xs text-zinc-500 mt-0.5">{t.menu_icon_desc ?? 'Shown in the header — opens the sidebar drawer.'}</p>
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(HEADER_MENU_ICONS).map(([key, { label, Icon }]) => {
            const active = menuIcon === key;
            const displayLabel = t.menu_icons?.[key] ?? label;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setMenuIcon(key)}
                className={`flex flex-col items-center justify-center gap-2 rounded-xl border p-4 transition-all ${
                  active
                    ? 'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500'
                    : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300'
                }`}
                aria-pressed={active}
              >
                <Icon className="h-7 w-7" strokeWidth={1.5} />
                <span className="text-xs font-medium text-center">{displayLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sidebar theme picker */}
      <div>
        <h3 className="text-sm font-semibold text-zinc-800">{t.theme ?? 'Sidebar theme'}</h3>
        <p className="text-xs text-zinc-500 mt-0.5">{t.theme_desc ?? 'Color palette applied to the sidebar drawer.'}</p>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Object.entries(SIDEBAR_THEMES).map(([key, entry]) => {
            const active = theme === key;
            const [bg, accent] = entry.swatch;
            const themeI18n = t.themes?.[key] ?? {};
            const themeLabel = themeI18n.label ?? entry.label;
            const themeDesc = themeI18n.description ?? entry.description;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTheme(key)}
                className={`flex items-center gap-4 rounded-xl border p-4 text-left transition-all ${
                  active
                    ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                    : 'border-zinc-200 bg-white hover:border-zinc-300'
                }`}
                aria-pressed={active}
              >
                <span
                  className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-zinc-200"
                  style={{ backgroundColor: bg }}
                >
                  <span
                    className="h-6 w-6 rounded-full"
                    style={{ backgroundColor: accent }}
                  />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-zinc-900">{themeLabel}</span>
                  <span className="block text-xs text-zinc-500 mt-0.5">{themeDesc}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end pt-2 border-t border-zinc-100">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-[5px] bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saving ? (t.saving ?? 'Saving…') : (t.save ?? 'Save changes')}
        </button>
      </div>
    </div>
  );
}

// ── Mobile bottom navigation ──────────────────────────────────────────────
// Master enable flag + per-button visibility toggles for the storefront's
// mobile bottom nav bar (component: `src/components/shop/MobileBottomNav.js`).
// All values are stored in the `store_settings` table as string flags
// (`'true'` / `'false'`) so the same code path as the other display
// settings applies.
function MobileNavSection() {
  const dict = useDictionary();
  const t = dict?.admin?.settings?.mobile_nav ?? {};
  const tRoot = dict?.admin?.settings ?? {};
  const [enabled, setEnabled] = useState(true);
  const [buttons, setButtons] = useState({
    home: true,
    favorites: true,
    cart: true,
    orders: false,
    account: true,
    menu: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/v1/settings')
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data) {
          const d = json.data;
          setEnabled(d.mobile_nav_enabled !== 'false');
          setButtons({
            home:      d.mobile_nav_show_home      !== 'false',
            favorites: d.mobile_nav_show_favorites !== 'false',
            cart:      d.mobile_nav_show_cart      !== 'false',
            orders:    d.mobile_nav_show_orders    === 'true',
            account:   d.mobile_nav_show_account   !== 'false',
            // Menu is always on — admins can't disable it.
            menu:      true,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggleBtn = (key) =>
    setButtons((b) => ({ ...b, [key]: !b[key] }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/v1/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mobile_nav_enabled:        String(enabled),
          mobile_nav_show_home:      String(buttons.home),
          mobile_nav_show_favorites: String(buttons.favorites),
          mobile_nav_show_cart:      String(buttons.cart),
          mobile_nav_show_orders:    String(buttons.orders),
          mobile_nav_show_account:   String(buttons.account),
          // Menu is always on; save as 'true' unconditionally.
          mobile_nav_show_menu:      'true',
        }),
      });
      const json = await res.json();
      if (json.success) toast.success(t.saved ?? 'Mobile nav saved');
      else toast.error(json.error ?? 'Save failed');
    } catch {
      toast.error('Network error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-zinc-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  const BUTTONS = [
    { key: 'home',      Icon: Home,         label: t.btn_home      ?? 'Home',
      description: t.btn_home_desc      ?? 'Link to the storefront home page.' },
    { key: 'favorites', Icon: Heart,        label: t.btn_favorites ?? 'Favorites',
      description: t.btn_favorites_desc ?? 'Opens the current user\u2019s wishlist.' },
    { key: 'cart',      Icon: ShoppingCart, label: t.btn_cart      ?? 'Cart',
      description: t.btn_cart_desc      ?? 'Opens the cart sidebar with an item-count badge.' },
    { key: 'orders',    Icon: Package,      label: t.btn_orders    ?? 'Orders',
      description: t.btn_orders_desc    ?? 'Link to the current user\u2019s order history.' },
    { key: 'account',   Icon: User,         label: t.btn_account   ?? 'Account',
      description: t.btn_account_desc   ?? 'Link to profile/settings.' },
    { key: 'menu',      Icon: MenuIcon,     label: t.btn_menu      ?? 'Menu',
      description: t.btn_menu_desc      ?? 'Opens the sidebar menu. Any button also enabled above is hidden from the sidebar to avoid duplication.' },
  ];

  const activeCount = BUTTONS.filter((b) => buttons[b.key]).length;

  return (
    <div className="space-y-8">
      <SectionHeader
        title={t.title ?? 'Mobile Bottom Navigation'}
        description={t.description ?? 'Bottom tab bar shown on phones and small tablets. Hidden on desktop (\u2265 1024px).'}
        icon={<Smartphone className="h-5 w-5 text-blue-600" />}
      />

      {/* Master enable toggle */}
      <div className="flex items-start justify-between gap-4 rounded-xl border border-zinc-200 bg-white p-4">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-zinc-800">
            {t.enable ?? 'Show mobile bottom navigation'}
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            {t.enable_desc ?? 'When off, no bottom nav bar is rendered on the storefront regardless of button toggles below.'}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => setEnabled((v) => !v)}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
            enabled ? 'bg-blue-600' : 'bg-zinc-300'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
              enabled ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      {/* Per-button toggles */}
      <div>
        <h3 className="text-sm font-semibold text-zinc-800">
          {t.buttons_title ?? 'Buttons & pages'}
        </h3>
        <p className="text-xs text-zinc-500 mt-0.5">
          {t.buttons_desc ?? 'Choose which items appear in the bottom bar. We recommend keeping between 3 and 5 buttons for the best mobile experience.'}
        </p>
        {activeCount >= 5 && (
          <p className="mt-2 text-xs text-blue-600">
            {t.cap_reached ?? 'Maximum of 5 buttons reached. Turn one off to enable another.'}
          </p>
        )}
        {activeCount === 0 && enabled && (
          <p className="mt-2 text-xs text-red-600">
            {t.none_enabled ?? 'No buttons are enabled — the bottom bar will not appear even though it is turned on.'}
          </p>
        )}

        <div className="mt-3 space-y-2">
          {BUTTONS.map(({ key, Icon, label, description }) => {
            const active = buttons[key];
            const locked = key === 'menu';
            // Hard cap of 5 active buttons total (including the always-on
            // Menu). Once we're at the cap, any *unchecked* row can't be
            // toggled on — only checked ones can be turned off.
            const atCap = activeCount >= 5 && !active && !locked;
            return (
              <label
                key={key}
                className={`flex items-start gap-3 rounded-xl border p-3 transition-colors ${
                  active
                    ? 'border-blue-500 bg-blue-50/40'
                    : 'border-zinc-200 bg-white hover:border-zinc-300'
                } ${!enabled ? 'opacity-50' : ''} ${
                  atCap ? 'opacity-50' : ''
                } ${
                  locked || atCap ? 'cursor-not-allowed' : 'cursor-pointer'
                }`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    active ? 'bg-blue-600 text-white' : 'bg-zinc-100 text-zinc-500'
                  }`}
                >
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-zinc-900">
                    {label}
                  </span>
                  <span className="block text-xs text-zinc-500 mt-0.5">
                    {description}
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={active}
                  disabled={!enabled || locked || atCap}
                  onChange={() => { if (!locked && !atCap) toggleBtn(key); }}
                  className={`mt-1 h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 ${
                    locked ? 'hidden' : ''
                  }`}
                />
                {locked && (
                  <span className="mt-0.5 shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700">
                    {t.always_on ?? 'Always on'}
                  </span>
                )}
              </label>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end pt-2 border-t border-zinc-100">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-[5px] bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saving
            ? (tRoot.saving ?? 'Saving\u2026')
            : (tRoot.save ?? 'Save changes')}
        </button>
      </div>
    </div>
  );
}

// Tiny inline swatch + colour input pair. One line, no decoration.
function Swatch({ label, value, onChange }) {
  return (
    <label className="flex items-center justify-between gap-3 py-2">
      <span className="text-xs text-zinc-700 truncate">{label}</span>
      <span className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-6 w-6 rounded cursor-pointer p-0 border border-zinc-300 bg-transparent"
          style={{ appearance: 'none', WebkitAppearance: 'none' }}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => {
            const v = e.target.value;
            if (/^#[0-9a-fA-F]{0,6}$/.test(v)) onChange(v);
          }}
          maxLength={7}
          spellCheck={false}
          className="w-20 rounded border border-zinc-200 px-2 py-1 text-[11px] font-mono text-zinc-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </span>
    </label>
  );
}

// ── Card Layout presets ─────────────────────────────────────────────────────
const LAYOUT_PRESETS = [
  {
    value: 'overlay',
    label: 'Overlay',
    description: 'Title and price overlaid on the image with a soft gradient.',
  },
  {
    value: 'classic',
    label: 'Classic',
    description: 'Edge-to-edge image, centered title and price below.',
  },
  {
    value: 'minimal',
    label: 'Minimal',
    description: 'Edge-to-edge image, left-aligned info with refined typography.',
  },
  {
    value: 'bordered',
    label: 'Bordered',
    description: 'Bordered card with internal padding — premium boutique feel.',
  },
  {
    value: 'shadow',
    label: 'Soft Shadow',
    description: 'Floating card with a subtle shadow that lifts on hover.',
  },
  {
    value: 'showcase',
    label: 'Showcase',
    description: 'Premium boutique — favorite heart, image dots, and circular arrow CTA.',
  },
  {
    value: 'boutique',
    label: 'Boutique',
    description: 'Bordered card with brand line, title, price, and full-width pill Buy Now button.',
  },
  {
    value: 'floating',
    label: 'Floating',
    description: 'Edge-to-edge image with a circular discount badge and a floating white pill (cart + favorite) over the image.',
  },
  {
    value: 'retail',
    label: 'Retail',
    description: 'Compact iHerb-style card — contained image, category, name, rating, price, and orange Add button.',
  },
];

const PREVIEW_PRODUCT = {
  id: 'preview-product',
  name: 'Preview Product',
  short_description: 'A sample card preview for storefront styling.',
  price: 299,
  effective_price: 299,
  main_image: null,
  image: null,
  category_name: 'Preview',
};

function normalizePreviewProduct(product) {
  if (!product) return PREVIEW_PRODUCT;

  const image = getMainImage(product) ?? product.main_image ?? product.image ?? PREVIEW_PRODUCT.main_image;
  return {
    ...PREVIEW_PRODUCT,
    ...product,
    id: product.id ?? PREVIEW_PRODUCT.id,
    name: product.name ?? PREVIEW_PRODUCT.name,
    price: product.price ?? product.effective_price ?? PREVIEW_PRODUCT.price,
    effective_price: product.effective_price ?? product.price ?? PREVIEW_PRODUCT.effective_price,
    main_image: image,
    image,
    category_name: product.category_name ?? product.category?.name ?? PREVIEW_PRODUCT.category_name,
  };
}

// Tiny CSS-only mini preview for each layout — used inside preset picker tiles
function LayoutMiniPreview({ value }) {
  const wrapBase = "flex flex-col w-full h-full bg-white";
  switch (value) {
    case 'overlay':
      return (
        <div className={`${wrapBase} rounded`}>
          <div className="relative flex-1 bg-gradient-to-br from-zinc-200 to-zinc-300 rounded-t">
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-1.5 space-y-1">
              <div className="h-1 w-2/3 bg-white/90 rounded-sm" />
              <div className="h-1 w-1/3 bg-white/70 rounded-sm" />
            </div>
          </div>
          <div className="h-2.5 bg-zinc-900 m-0 rounded-b" />
        </div>
      );
    case 'classic':
      return (
        <div className={wrapBase}>
          <div className="flex-1 bg-gradient-to-br from-zinc-200 to-zinc-300" />
          <div className="py-1 flex flex-col items-center gap-0.5">
            <div className="h-1 w-1/2 bg-zinc-700 rounded-sm" />
            <div className="h-1 w-1/4 bg-zinc-400 rounded-sm" />
          </div>
          <div className="h-2.5 bg-zinc-900" />
        </div>
      );
    case 'minimal':
      return (
        <div className={wrapBase}>
          <div className="flex-1 bg-gradient-to-br from-zinc-200 to-zinc-300" />
          <div className="py-1 px-1 flex flex-col items-start gap-0.5">
            <div className="h-1 w-2/3 bg-zinc-700 rounded-sm" />
            <div className="h-1 w-1/3 bg-zinc-400 rounded-sm" />
          </div>
          <div className="h-2.5 bg-zinc-900" />
        </div>
      );
    case 'bordered':
      return (
        <div className={`${wrapBase} border border-zinc-300 rounded p-1`}>
          <div className="flex-1 bg-gradient-to-br from-zinc-200 to-zinc-300 rounded-sm" />
          <div className="py-1 flex flex-col items-center gap-0.5">
            <div className="h-1 w-1/2 bg-zinc-700 rounded-sm" />
            <div className="h-1 w-1/4 bg-zinc-400 rounded-sm" />
          </div>
          <div className="h-2.5 bg-zinc-900 rounded-sm" />
        </div>
      );
    case 'shadow':
      return (
        <div className={`${wrapBase} rounded shadow-md p-1`}>
          <div className="flex-1 bg-gradient-to-br from-zinc-200 to-zinc-300 rounded-sm" />
          <div className="py-1 flex flex-col items-center gap-0.5">
            <div className="h-1 w-1/2 bg-zinc-700 rounded-sm" />
            <div className="h-1 w-1/4 bg-zinc-400 rounded-sm" />
          </div>
          <div className="h-2.5 bg-zinc-900 rounded-sm" />
        </div>
      );
    case 'showcase':
      return (
        <div className="flex flex-col w-full h-full bg-zinc-100 rounded-lg p-1">
          <div className="relative flex-1 bg-gradient-to-br from-zinc-200 to-zinc-300 rounded-md">
            <div className="absolute right-1 top-1 h-2 w-2 rounded-full bg-white/90" />
            <div className="absolute inset-x-0 bottom-1 flex items-center justify-center gap-0.5">
              <span className="h-[3px] w-[3px] rounded-full bg-white" />
              <span className="h-[3px] w-[3px] rounded-full bg-white/50" />
              <span className="h-[3px] w-[3px] rounded-full bg-white/50" />
            </div>
          </div>
          <div className="py-1 px-1 flex items-center justify-between gap-1">
            <div className="flex flex-col gap-0.5 flex-1">
              <div className="h-1 w-2/3 bg-zinc-700 rounded-sm" />
              <div className="h-1 w-1/3 bg-zinc-900 rounded-sm" />
            </div>
            <div className="h-2.5 w-2.5 rounded-full bg-zinc-900" />
          </div>
        </div>
      );
    case 'boutique':
      return (
        <div className="flex flex-col w-full h-full bg-white rounded-lg border border-zinc-300 p-1">
          <div className="relative flex-1 bg-zinc-100 rounded-md">
            <div className="absolute left-1 top-1 h-1.5 w-4 rounded-full bg-white" />
            <div className="absolute right-1 top-1 h-2 w-2 rounded-full bg-white" />
            <div className="absolute inset-x-0 bottom-1 flex items-center justify-center gap-0.5">
              <span className="h-[3px] w-[3px] rounded-full bg-emerald-600" />
              <span className="h-[3px] w-[3px] rounded-full bg-zinc-300" />
            </div>
          </div>
          <div className="py-0.5 px-1 flex flex-col gap-[2px]">
            <div className="h-1 w-1/3 bg-emerald-600 rounded-sm" />
            <div className="h-1 w-2/3 bg-zinc-700 rounded-sm" />
          </div>
          <div className="h-3 mx-1 mb-0.5 bg-zinc-900 rounded-full" />
        </div>
      );
    case 'floating':
      return (
        <div className={wrapBase}>
          <div className="relative flex-1 bg-gradient-to-br from-zinc-200 to-zinc-300">
            <div className="absolute left-1 top-1 h-3 w-3 rounded-full bg-[#c8a85a]" />
            <div className="absolute left-1/2 -translate-x-1/2 bottom-1 flex items-center gap-0.5 rounded-full bg-white px-1 py-[2px] shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-zinc-700" />
              <span className="h-1.5 w-1.5 rounded-full bg-zinc-700" />
            </div>
          </div>
          <div className="py-1 flex flex-col items-center gap-0.5">
            <div className="h-1 w-1/2 bg-zinc-700 rounded-sm" />
            <div className="h-1 w-1/4 bg-zinc-400 rounded-sm" />
            <div className="h-1 w-1/3 bg-[#c8a85a] rounded-sm" />
          </div>
        </div>
      );
    case 'retail':
      return (
        <div className="flex flex-col w-full h-full bg-white rounded-lg border border-zinc-200 overflow-hidden shadow-sm">
          <div className="relative flex-1 bg-[#f5f5f5] flex items-center justify-center">
            <div className="h-3/5 w-3/5 rounded bg-zinc-200" />
            <div className="absolute left-1 top-1 h-1.5 w-5 rounded-sm bg-[#fff3dc]" />
          </div>
          <div className="px-1.5 py-1 flex flex-col gap-[3px]">
            <div className="h-[3px] w-1/3 bg-zinc-300 rounded-sm" />
            <div className="h-[3px] w-3/4 bg-zinc-600 rounded-sm" />
            <div className="h-[3px] w-1/2 bg-zinc-400 rounded-sm" />
            <div className="h-[3px] w-2/5 bg-zinc-800 rounded-sm" />
            <div className="h-2.5 w-2/3 bg-[#ff9200] rounded-md mt-0.5" />
          </div>
        </div>
      );
    default:
      return null;
  }
}

// ── Carousel Section ──────────────────────────────────────────────────────────
function CarouselSection() {
  const dict = useDictionary();
  const t = dict?.admin?.settings?.carousel ?? {};
  const [itemsMobile,  setItemsMobile]  = useState(2);
  const [itemsTablet,  setItemsTablet]  = useState(3);
  const [itemsDesktop, setItemsDesktop] = useState(4);
  const [productsPerRow, setProductsPerRow] = useState(8);
  const [autoplay,     setAutoplay]     = useState(true);
  const [interval,     setCarouselInterval] = useState(3000);
  const [speed,        setSpeed]        = useState(500);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    fetch('/api/v1/settings')
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data) {
          const d = json.data;
          if (d.carousel_items_mobile)  setItemsMobile(parseInt(d.carousel_items_mobile)  || 2);
          if (d.carousel_items_tablet)  setItemsTablet(parseInt(d.carousel_items_tablet)  || 3);
          if (d.carousel_items_desktop) setItemsDesktop(parseInt(d.carousel_items_desktop) || 4);
          if (d.carousel_products_per_row) setProductsPerRow(parseInt(d.carousel_products_per_row) || 8);
          if (d.carousel_autoplay !== undefined) setAutoplay(d.carousel_autoplay !== 'false');
          if (d.carousel_interval) setCarouselInterval(parseInt(d.carousel_interval) || 3000);
          if (d.carousel_speed)    setSpeed(parseInt(d.carousel_speed) || 500);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await fetch('/api/v1/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          carousel_items_mobile:  String(itemsMobile),
          carousel_items_tablet:  String(itemsTablet),
          carousel_items_desktop: String(itemsDesktop),
          carousel_products_per_row: String(productsPerRow),
          carousel_autoplay:      String(autoplay),
          carousel_interval:      String(interval),
          carousel_speed:         String(speed),
        }),
      });
      toast.success('Carousel settings saved');
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setItemsMobile(2);
    setItemsTablet(3);
    setItemsDesktop(4);
    setProductsPerRow(8);
    setAutoplay(true);
    setCarouselInterval(3000);
    setSpeed(500);
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-12 rounded-lg bg-zinc-100" />
        ))}
      </div>
    );
  }

  const NumStepper = ({ label, hint, value, onChange, min = 1, max = 6 }) => (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white px-4 py-3.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-zinc-900">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-zinc-500">{hint}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100 disabled:opacity-40 transition-colors text-lg font-medium leading-none"
        >−</button>
        <span className="w-5 text-center text-sm font-semibold text-zinc-900 tabular-nums">{value}</span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100 disabled:opacity-40 transition-colors text-lg font-medium leading-none"
        >+</button>
      </div>
    </div>
  );

  return (
    <>
      <SectionHeader
        title={t.title ?? "Product Carousel"}
        description={t.description ?? "Control how the featured products carousel behaves on your storefront."}
      />
      <div className="space-y-3">

        {/* Products per row */}
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{t.row_chunking ?? "Row chunking"}</p>
        <NumStepper
          label={t.products_per_row ?? "Products per row"}
          hint={t.products_per_row_hint ?? "Total products assigned to each row before chunking into a new row"}
          value={productsPerRow}
          onChange={setProductsPerRow}
          min={1} max={24}
        />

        {/* Items per row */}
        <p className="pt-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">{t.visible_cards ?? "Visible cards per row"}</p>
        <NumStepper
          label={t.mobile ?? "Mobile"}
          hint={t.mobile_hint ?? "Screens narrower than 640 px"}
          value={itemsMobile}
          onChange={setItemsMobile}
          min={1} max={4}
        />
        <NumStepper
          label={t.tablet ?? "Tablet"}
          hint={t.tablet_hint ?? "640 px – 1023 px"}
          value={itemsTablet}
          onChange={setItemsTablet}
          min={1} max={5}
        />
        <NumStepper
          label={t.desktop ?? "Desktop"}
          hint={t.desktop_hint ?? "1024 px and wider"}
          value={itemsDesktop}
          onChange={setItemsDesktop}
          min={1} max={6}
        />

        {/* Autoplay toggle */}
        <div className="mt-2 flex items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white px-4 py-3.5">
          <div>
            <p className="text-sm font-medium text-zinc-900">{t.autoplay ?? "Autoplay"}</p>
            <p className="mt-0.5 text-xs text-zinc-500">{t.autoplay_desc ?? "Automatically advance slides"}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={autoplay}
            onClick={() => setAutoplay(!autoplay)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${autoplay ? 'bg-blue-600' : 'bg-zinc-200'}`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 ${autoplay ? 'translate-x-5 rtl:-translate-x-5' : 'translate-x-0'}`}
            />
          </button>
        </div>

        {/* Interval slider */}
        <div className={`rounded-xl border border-zinc-200 bg-white px-4 py-3.5 transition-opacity ${!autoplay ? 'opacity-40 pointer-events-none' : ''}`}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-zinc-900">{t.autoplay_interval ?? "Autoplay interval"}</p>
            <span className="text-xs font-semibold text-zinc-700 tabular-nums bg-zinc-100 px-2 py-0.5 rounded-md">{(interval / 1000).toFixed(1)}s</span>
          </div>
          <input
            type="range"
            min={1000} max={8000} step={500}
            value={interval}
            onChange={(e) => setCarouselInterval(Number(e.target.value))}
            className="w-full h-1.5 rounded-full accent-blue-600"
          />
          <div className="flex justify-between mt-1 text-[10px] text-zinc-400 font-medium">
            <span>1 s</span><span>8 s</span>
          </div>
        </div>

        {/* Speed slider */}
        <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3.5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-zinc-900">{t.transition_speed ?? "Transition speed"}</p>
            <span className="text-xs font-semibold text-zinc-700 tabular-nums bg-zinc-100 px-2 py-0.5 rounded-md">{speed} ms</span>
          </div>
          <input
            type="range"
            min={100} max={1200} step={50}
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="w-full h-1.5 rounded-full accent-blue-600"
          />
          <div className="flex justify-between mt-1 text-[10px] text-zinc-400 font-medium">
            <span>100 ms</span><span>1200 ms</span>
          </div>
        </div>

        {/* Save / Reset bar */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={reset}
            className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-[5px] bg-zinc-900 px-5 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-60 transition-colors"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </>
  );
}

function LayoutSection() {
  const tL = useDictionary()?.admin?.settings?.layout ?? {};
  const [layout, setLayout] = useState('overlay');
  const [showShortDescription, setShowShortDescription] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewProduct, setPreviewProduct] = useState(PREVIEW_PRODUCT);
  // Display settings (read-only here; we just need them to render an accurate preview)
  const [displaySettings, setDisplaySettings] = useState({
    product_card_button_style: 'add_to_cart',
    product_card_filled_bg: '#18181b',
    product_card_filled_text: '#ffffff',
    product_card_outline_border: '#18181b',
    product_card_outline_text: '#18181b',
    product_card_outline_icon: '#18181b',
    product_card_outline_bg: 'transparent',
    product_card_button_font_size: '10',
  });

  useEffect(() => {
    Promise.all([
      fetch('/api/v1/settings').then((r) => r.json()),
      fetch('/api/v1/products?limit=1&status=active').then((r) => r.json()),
    ])
      .then(([settings, products]) => {
        if (settings.success && settings.data) {
          if (settings.data.product_card_layout) setLayout(settings.data.product_card_layout);
          setShowShortDescription(settings.data.product_card_show_short_description === 'true');
          setDisplaySettings((s) => ({ ...s, ...settings.data }));
        }
        setPreviewProduct(normalizePreviewProduct(products.success ? products.data?.[0] : null));
      })
      .catch(() => setPreviewProduct(PREVIEW_PRODUCT))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/v1/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_card_layout: layout,
          product_card_show_short_description: showShortDescription ? 'true' : 'false',
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? 'Save failed');
      toast.success(tL.saved ?? 'Card layout saved');
    } catch (err) {
      toast.error(err.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-10 rounded-lg bg-zinc-100 mb-3" />
        <div className="h-48 rounded-lg bg-zinc-100" />
      </div>
    );
  }

  return (
    <div>
      <SectionHeader
        title={tL.title ?? 'Product Card Layout'}
        description={tL.desc ?? 'Choose a ready-made card layout for your storefront. Pair it with the colours and button styles from the previous tab.'}
      />

      <div className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-zinc-900">
            {tL.short_description_toggle ?? 'Show short description'}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {tL.short_description_hint ?? 'Display the product short description inside product cards.'}
          </p>
        </div>
        <Toggle checked={showShortDescription} onChange={setShowShortDescription} />
      </div>

      {/* Preset picker — horizontal scroll so all tiles stay readable at any viewport */}
      <div
        className="mb-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7 gap-3"
        role="radiogroup"
        aria-label="Card layout"
      >
        {LAYOUT_PRESETS.map((preset) => {
          const selected = layout === preset.value;
          return (
            <button
              key={preset.value}
              type="button"
              onClick={() => setLayout(preset.value)}
              className={`group/preset text-left rounded-xl border-2 transition-all overflow-hidden ${
                selected
                  ? 'border-blue-600 ring-2 ring-blue-200 bg-blue-50/40'
                  : 'border-zinc-200 hover:border-zinc-300 bg-white'
              }`}
            >
              <div className="aspect-[3/4] bg-zinc-50 p-2.5 border-b border-zinc-100">
                <LayoutMiniPreview value={preset.value} />
              </div>
              <div className="p-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border-2 ${
                      selected ? 'border-blue-600' : 'border-zinc-300'
                    }`}
                  >
                    {selected && <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />}
                  </span>
                  <span className={`text-sm font-semibold leading-tight ${selected ? 'text-blue-700' : 'text-zinc-900'}`}>
                    {tL.presets?.[preset.value]?.label ?? preset.label}
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-zinc-500 line-clamp-3">
                  {tL.presets?.[preset.value]?.description ?? preset.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Live preview */}
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 sm:p-8">
        <p className="text-[10px] uppercase tracking-widest text-zinc-400 font-semibold mb-4 text-center">
          {tL.preview ?? 'Live preview'}
        </p>
        <div className="mx-auto w-full max-w-[260px] pointer-events-none select-none bg-white">
          {previewProduct ? (
            <ProductCard
              key={`layout-preview-${layout}`}
              product={previewProduct}
              layout={layout}
              buttonStyle={displaySettings.product_card_button_style}
              filledBg={displaySettings.product_card_filled_bg}
              filledText={displaySettings.product_card_filled_text}
              outlineBorder={displaySettings.product_card_outline_border}
              outlineText={displaySettings.product_card_outline_text}
              outlineIcon={displaySettings.product_card_outline_icon}
              outlineBg={displaySettings.product_card_outline_bg}
              buttonFontSize={parseInt(displaySettings.product_card_button_font_size) || 10}
              showShortDescription={showShortDescription}
              hideButtons={displaySettings.product_card_hide_buttons === 'true'}
            />
          ) : (
            <div className="animate-pulse">
              <div className="aspect-square w-full rounded-[5px] bg-zinc-100 mb-4" />
              <div className="h-3 w-3/4 mx-auto bg-zinc-100 rounded mb-2" />
              <div className="h-3 w-1/2 mx-auto bg-zinc-100 rounded mb-4" />
              <div className="h-9 w-full bg-zinc-100 rounded-[5px]" />
            </div>
          )}
        </div>
      </div>

      {/* Save bar */}
      <div className="mt-6 flex items-center justify-between sm:justify-end sm:gap-6 border-t border-zinc-100 pt-5">
        <button
          type="button"
          onClick={() => {
            setLayout('overlay');
            setShowShortDescription(false);
          }}
          className="text-sm font-medium text-zinc-500 hover:text-zinc-900"
        >
          <span className="hidden sm:inline">{tL.reset ?? 'Reset to defaults'}</span>
          <span className="sm:hidden">{tL.reset_short ?? 'Reset'}</span>
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-[5px] bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          <span className="hidden sm:inline">{saving ? (tL.saving ?? 'Saving…') : (tL.save ?? 'Save Layout')}</span>
          <span className="sm:hidden">{saving ? (tL.saving ?? 'Saving…') : (tL.save_short ?? 'Save')}</span>
        </button>
      </div>
    </div>
  );
}

function DisplaySection() {
  const tD = useDictionary()?.admin?.settings?.display ?? {};
  const tBS = tD.button_styles ?? {};
  const [buttonStyle, setButtonStyle] = useState('add_to_cart');
  const [filledBg, setFilledBg] = useState('#18181b');
  const [filledText, setFilledText] = useState('#ffffff');
  const [outlineBorder, setOutlineBorder] = useState('#18181b');
  const [outlineText, setOutlineText] = useState('#18181b');
  const [outlineIcon, setOutlineIcon] = useState('#18181b');
  const [outlineBg, setOutlineBg] = useState('transparent');
  const [buttonFontSize, setButtonFontSize] = useState(10);
  const [cardLayout, setCardLayout] = useState('overlay');
  const [showShortDescription, setShowShortDescription] = useState(false);
  const [hideButtons, setHideButtons] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewProduct, setPreviewProduct] = useState(PREVIEW_PRODUCT);

  useEffect(() => {
    Promise.all([
      fetch('/api/v1/settings').then((r) => r.json()),
      fetch('/api/v1/products?limit=1&status=active').then((r) => r.json()),
    ])
      .then(([settings, products]) => {
        if (settings.success && settings.data) {
          const d = settings.data;
          if (d.product_card_button_style) setButtonStyle(d.product_card_button_style);
          if (d.product_card_filled_bg) setFilledBg(d.product_card_filled_bg);
          if (d.product_card_filled_text) setFilledText(d.product_card_filled_text);
          if (d.product_card_outline_border) setOutlineBorder(d.product_card_outline_border);
          if (d.product_card_outline_text) setOutlineText(d.product_card_outline_text);
          if (d.product_card_outline_icon) setOutlineIcon(d.product_card_outline_icon);
          if (d.product_card_outline_bg) setOutlineBg(d.product_card_outline_bg);
          if (d.product_card_button_font_size) setButtonFontSize(parseInt(d.product_card_button_font_size) || 10);
          if (d.product_card_layout) setCardLayout(d.product_card_layout);
          setShowShortDescription(d.product_card_show_short_description === 'true');
          setHideButtons(d.product_card_hide_buttons === 'true');
        }
        setPreviewProduct(normalizePreviewProduct(products.success ? products.data?.[0] : null));
      })
      .catch(() => setPreviewProduct(PREVIEW_PRODUCT))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/v1/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_card_button_style:  buttonStyle,
          product_card_filled_bg:     filledBg,
          product_card_filled_text:   filledText,
          product_card_outline_border: outlineBorder,
          product_card_outline_text:   outlineText,
          product_card_outline_icon:   outlineIcon,
          product_card_outline_bg:    outlineBg,
          product_card_button_font_size: String(buttonFontSize),
          product_card_hide_buttons:  hideButtons ? 'true' : 'false',
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? 'Save failed');
      toast.success(tD.saved ?? 'Display settings saved');
    } catch (err) {
      toast.error(err.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const usesButtonBlock = !['showcase', 'boutique', 'floating', 'retail'].includes(cardLayout);
  const isRetailLayout   = cardLayout === 'retail';
  const hasOwnButton     = ['showcase', 'boutique', 'floating'].includes(cardLayout);

  const styleHasFilled  = usesButtonBlock && ['shop_now', 'horizontal_style1', 'horizontal_style2', 'vertical'].includes(buttonStyle);
  const styleHasOutline = isRetailLayout || (usesButtonBlock && ['add_to_cart', 'horizontal_style1', 'horizontal_style2', 'vertical'].includes(buttonStyle));
  const styleHasIcon    = isRetailLayout || (usesButtonBlock && buttonStyle === 'horizontal_style1');
  const showFontSize    = !hasOwnButton;

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-10 rounded-lg bg-zinc-100 mb-3" />
        <div className="h-48 rounded-lg bg-zinc-100" />
      </div>
    );
  }

  return (
    <div>
      <SectionHeader
        title={tD.title ?? 'Product Card Display'}
        description={tD.desc ?? 'Pick a button layout and tune its colours. The preview updates live.'}
      />

      {usesButtonBlock && (
      <div className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-zinc-900">
            {tD.hide_buttons_toggle ?? 'Hide buttons'}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {tD.hide_buttons_hint ?? 'Remove the Shop Now and Add to Cart buttons from product cards.'}
          </p>
        </div>
        <Toggle checked={hideButtons} onChange={setHideButtons} />
      </div>
      )}

      {usesButtonBlock && (
      <div className={`mb-6 flex flex-wrap gap-2.5 transition-opacity duration-200 ${hideButtons ? 'opacity-40 pointer-events-none select-none' : ''}`} role="radiogroup" aria-label="Button Styles">
        {BUTTON_STYLE_OPTIONS.map((opt) => {
          const selected = buttonStyle === opt.value;
          return (
            <label
              key={opt.value}
              className={`flex items-center gap-2.5 cursor-pointer rounded-lg border px-3.5 py-2.5 text-sm font-medium transition-all select-none ${
                selected
                  ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm'
                  : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-900'
              }`}
            >
              <input
                type="radio"
                name="buttonStyle"
                value={opt.value}
                checked={selected}
                onChange={() => setButtonStyle(opt.value)}
                className="sr-only"
              />
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                  selected ? 'border-blue-600' : 'border-zinc-300'
                }`}
              >
                {selected && <span className="h-2 w-2 rounded-full bg-blue-600" />}
              </span>
              {tBS[opt.value]?.label ?? opt.label}
            </label>
          );
        })}
      </div>
      )}

      {/* 2. Workshop panel — preview LEFT, controls RIGHT */}
      <div className="rounded-xl border border-zinc-200 overflow-hidden grid grid-cols-1 md:grid-cols-2">
        {/* Preview */}
        <div className="bg-zinc-50 border-b md:border-b-0 md:border-r border-zinc-200 flex flex-col items-center justify-center p-6 gap-3">
          <span className="text-[10px] uppercase tracking-widest text-zinc-400 font-semibold">{tD.preview ?? 'Preview'}</span>
          <div className="w-full max-w-[240px] pointer-events-none select-none">
            {previewProduct ? (
              <ProductCard
                key={`button-preview-${buttonStyle}-${cardLayout}`}
                product={previewProduct}
                layout={cardLayout}
                buttonStyle={buttonStyle}
                filledBg={filledBg}
                filledText={filledText}
                outlineBorder={outlineBorder}
                outlineText={outlineText}
                outlineIcon={outlineIcon}
                outlineBg={outlineBg}
                buttonFontSize={buttonFontSize}
                showShortDescription={showShortDescription}
                hideButtons={hideButtons}
              />
            ) : (
              <div className="animate-pulse">
                <div className="aspect-square w-full rounded-[5px] bg-zinc-100 mb-4" />
                <div className="h-3 w-3/4 mx-auto bg-zinc-100 rounded mb-2" />
                <div className="h-3 w-1/2 mx-auto bg-zinc-100 rounded mb-4" />
                <div className="h-9 w-full bg-zinc-100 rounded-[5px]" />
              </div>
            )}
          </div>
          <p className="text-xs text-zinc-500 text-center max-w-[240px]">
            {usesButtonBlock
              ? (tBS[buttonStyle]?.desc ?? BUTTON_STYLE_OPTIONS.find((o) => o.value === buttonStyle)?.description)
              : isRetailLayout
              ? (tD.retail_desc ?? 'Compact Add to Cart button with cart icon — colours controlled by the outline button settings.')
              : (tD.own_button_desc ?? 'This layout uses a built-in button whose style is set by the Card Layout.')}
          </p>
        </div>

        {/* Controls */}
        <div className={`p-5 transition-opacity duration-200 ${hideButtons && usesButtonBlock ? 'opacity-40 pointer-events-none select-none' : ''}`}>
          {hasOwnButton && (
            <div className="flex h-full items-center justify-center rounded-lg bg-zinc-50 border border-zinc-200 p-5 text-center">
              <p className="text-sm text-zinc-500">
                {tD.own_button_notice ?? 'The active card layout has a built-in button. Switch to a different layout to customise button colours.'}
              </p>
            </div>
          )}
          {styleHasFilled && (
            <div className="mb-4">
              <p className="text-[10px] uppercase tracking-widest text-zinc-400 font-semibold mb-1">{tD.filled_group ?? 'Filled button'}</p>
              <Swatch label={tD.filled_bg_label ?? 'Background'} value={filledBg} onChange={setFilledBg} />
              <Swatch label={tD.filled_text_label ?? 'Text'} value={filledText} onChange={setFilledText} />
            </div>
          )}
          {styleHasOutline && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-zinc-400 font-semibold mb-1">{tD.outline_group ?? 'Outline button'}</p>
              <Swatch label={tD.outline_border_label ?? 'Border'} value={outlineBorder} onChange={setOutlineBorder} />
              <Swatch label={tD.outline_text_label ?? 'Text'} value={outlineText} onChange={setOutlineText} />
              {styleHasIcon && (
                <Swatch label={tD.outline_icon_label ?? 'Icon'} value={outlineIcon} onChange={setOutlineIcon} />
              )}
              <div className="flex items-center justify-between gap-3 py-2">
                <span className="text-xs text-zinc-700">{tD.outline_bg_label ?? 'Background'}</span>
                <span className="flex items-center gap-2">
                  {outlineBg !== 'transparent' && (
                    <input
                      type="color"
                      value={outlineBg}
                      onChange={(e) => setOutlineBg(e.target.value)}
                      className="h-6 w-6 rounded cursor-pointer p-0 border border-zinc-300 bg-transparent"
                      style={{ appearance: 'none', WebkitAppearance: 'none' }}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => setOutlineBg(outlineBg === 'transparent' ? outlineBorder : 'transparent')}
                    className={`text-[11px] font-medium px-2 py-1 rounded border ${outlineBg === 'transparent' ? 'border-zinc-300 bg-zinc-50 text-zinc-500' : 'border-blue-300 bg-blue-50 text-blue-700'}`}
                  >
                    {outlineBg === 'transparent' ? (tD.transparent ?? 'Transparent') : (tD.solid ?? 'Solid')}
                  </button>
                </span>
              </div>
            </div>
          )}

          {/* Font size picker */}
          {showFontSize && (
          <div className="mt-4 pt-4 border-t border-zinc-100">
            <p className="text-[10px] uppercase tracking-widest text-zinc-400 font-semibold mb-3">{tD.font_size_label ?? 'Button Text Size'}</p>
            <div className="flex items-center gap-2">
              {[{label:'XS',val:9},{label:'S',val:10},{label:'M',val:11},{label:'L',val:12},{label:'XL',val:13}].map(({label,val})=>(
                <button
                  key={val}
                  type="button"
                  onClick={()=>setButtonFontSize(val)}
                  className={`flex-1 rounded-md border py-1.5 text-xs font-semibold transition-colors ${
                    buttonFontSize===val
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300 hover:text-zinc-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[10px] text-zinc-400">{buttonFontSize}px</p>
          </div>
          )}
        </div>
      </div>

      {/* 3. Save bar */}
      <div className="mt-6 flex items-center justify-between sm:justify-end sm:gap-6 border-t border-zinc-100 pt-5">
        <button
          type="button"
          onClick={() => {
            setButtonStyle('add_to_cart');
            setFilledBg('#18181b');
            setFilledText('#ffffff');
            setOutlineBorder('#18181b');
            setOutlineText('#18181b');
            setOutlineIcon('#18181b');
            setOutlineBg('transparent');
            setButtonFontSize(10);
            setHideButtons(false);
          }}
          className="text-sm font-medium text-zinc-500 hover:text-zinc-900"
        >
          <span className="hidden sm:inline">{tD.reset ?? 'Reset to defaults'}</span>
          <span className="sm:hidden">{tD.reset_short ?? 'Reset'}</span>
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-[5px] bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          <span className="hidden sm:inline">{saving ? (tD.saving ?? 'Saving…') : (tD.save ?? 'Save Display Settings')}</span>
          <span className="sm:hidden">{saving ? (tD.saving ?? 'Saving…') : (tD.save_short ?? 'Save')}</span>
        </button>
      </div>
    </div>
  );
}

function IntegrationsSection() {
  const t = useDictionary()?.admin?.settings?.integrations ?? {};
  const [platform, setPlatform] = useState('telegram');
  const [form, setForm] = useState({
    telegram_bot_token: '',
    telegram_chat_id: '',
    whatsapp_access_token: '',
    whatsapp_phone_number_id: '',
    whatsapp_business_account_id: '',
    whatsapp_notifications_enabled: 'false',
    whatsapp_default_country_code: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [showWaToken, setShowWaToken] = useState(false);
  const [waTokenSet, setWaTokenSet] = useState(false);
  const [testing, setTesting] = useState(false);
  const [savedForm, setSavedForm] = useState(null);

  useEffect(() => {
    fetch('/api/v1/settings')
      .then((r) => r.json())
      .then(({ success, data, secretsSet }) => {
        if (success && data) {
          const next = {
            telegram_bot_token: data.telegram_bot_token ?? '',
            telegram_chat_id: data.telegram_chat_id ?? '',
            whatsapp_access_token: '',
            whatsapp_phone_number_id: data.whatsapp_phone_number_id ?? '',
            whatsapp_business_account_id: data.whatsapp_business_account_id ?? '',
            whatsapp_notifications_enabled: data.whatsapp_notifications_enabled ?? 'false',
            whatsapp_default_country_code: data.whatsapp_default_country_code ?? '',
          };
          setForm(next);
          setSavedForm(next);
          setWaTokenSet(Boolean(secretsSet?.whatsapp_access_token));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));
  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

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
      // If a new access token was submitted, it is now stored (masked) — clear
      // it from the form state so it is never held or re-sent from the client.
      if (form.whatsapp_access_token) setWaTokenSet(true);
      const cleared = { ...form, whatsapp_access_token: '' };
      setForm(cleared);
      setSavedForm(cleared);
      toast.success(t.saved ?? 'Settings saved');
    } catch (err) {
      toast.error(err.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await fetch('/api/v1/admin/whatsapp/test', { method: 'POST' });
      const json = await res.json();
      if (json.ok) {
        const name = json.data?.verified_name || json.data?.display_phone_number || '';
        toast.success((t.wa_test_ok ?? 'WhatsApp connection OK') + (name ? ` — ${name}` : ''));
      } else {
        const reasons = t.wa_test_errors ?? {};
        toast.error(reasons[json.error] ?? (t.wa_test_failed ?? 'WhatsApp connection failed'));
      }
    } catch {
      toast.error(t.wa_test_failed ?? 'WhatsApp connection failed');
    } finally {
      setTesting(false);
    }
  };

  const dirty = savedForm ? JSON.stringify(form) !== JSON.stringify(savedForm) : false;
  useUnsavedGuard(dirty, handleSave);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-10 rounded-[5px] bg-zinc-100" />
        ))}
      </div>
    );
  }

  const TelegramIcon = (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-blue-500" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.941z"/>
    </svg>
  );
  const WhatsAppIcon = (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-green-500" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );

  const telegramConfigured = Boolean(form.telegram_bot_token && form.telegram_chat_id);
  const whatsappConfigured =
    form.whatsapp_notifications_enabled === 'true' &&
    (waTokenSet || Boolean(form.whatsapp_access_token)) &&
    Boolean(form.whatsapp_phone_number_id);

  const PLATFORMS = [
    { id: 'telegram', label: t.telegram ?? 'Telegram', icon: TelegramIcon, configured: telegramConfigured },
    { id: 'whatsapp', label: t.whatsapp ?? 'WhatsApp', icon: WhatsAppIcon, configured: whatsappConfigured },
  ];

  return (
    <>
      <SectionHeader
        title={t.title ?? 'Integrations'}
        description={t.desc ?? 'Connect a platform to notify customers and your team about orders.'}
      />

      {/* Platform selector */}
      <div className="mb-5 flex flex-wrap gap-2">
        {PLATFORMS.map((p) => {
          const active = platform === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setPlatform(p.id)}
              className={`inline-flex items-center gap-2 rounded-[5px] border px-3.5 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'border-zinc-900 bg-zinc-900 text-white'
                  : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50'
              }`}
            >
              {p.icon}
              <span>{p.label}</span>
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  p.configured ? 'bg-green-500' : active ? 'bg-white/40' : 'bg-zinc-300'
                }`}
              />
            </button>
          );
        })}
      </div>

      {/* Platform panel */}
      <div className="rounded-[5px] border border-zinc-200 bg-white p-5">
        {platform === 'telegram' && (
          <>
            <p className="mb-4 text-xs text-zinc-500">
              {t.telegram_events_hint ?? 'Choose which events trigger a Telegram alert under the Notifications tab.'}
            </p>
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
          </>
        )}

        {platform === 'whatsapp' && (
          <>
            <p className="mb-4 text-xs text-zinc-500">
              {t.wa_cloud_desc ?? 'Send automated order updates to customers via the WhatsApp Business Cloud API. Configure which events are sent under the Notifications tab.'}
            </p>

            <Field label={t.wa_enabled ?? 'Enable WhatsApp notifications'}>
              <Toggle
                checked={form.whatsapp_notifications_enabled === 'true'}
                onChange={(v) => setField('whatsapp_notifications_enabled', String(v))}
              />
            </Field>

            <Field
              label={t.wa_access_token ?? 'Access Token'}
              hint={waTokenSet
                ? (t.wa_access_token_set_hint ?? 'A token is saved. Leave blank to keep it, or enter a new one to replace it.')
                : (t.wa_access_token_hint ?? 'Permanent access token from Meta \u2192 WhatsApp \u2192 API Setup')}
            >
              <div className="relative">
                <input
                  className={`${inputClass} pr-10`}
                  type={showWaToken ? 'text' : 'password'}
                  placeholder={waTokenSet ? '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022 (saved)' : 'EAAG...'}
                  value={form.whatsapp_access_token}
                  onChange={handleChange('whatsapp_access_token')}
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowWaToken((v) => !v)}
                  className="absolute inset-y-0 right-3 flex items-center text-zinc-400 hover:text-zinc-700"
                  tabIndex={-1}
                >
                  {showWaToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>

            <Field label={t.wa_phone_number_id ?? 'Phone Number ID'} hint={t.wa_phone_number_id_hint ?? 'Found in Meta \u2192 WhatsApp \u2192 API Setup'}>
              <input
                className={inputClass}
                placeholder="123456789012345"
                value={form.whatsapp_phone_number_id}
                onChange={(e) => setField('whatsapp_phone_number_id', e.target.value.replace(/[^0-9]/g, ''))}
                inputMode="numeric"
              />
            </Field>

            <Field label={t.wa_business_account_id ?? 'WhatsApp Business Account ID'} hint={t.wa_business_account_id_hint ?? 'Optional \u2014 required for template management'}>
              <input
                className={inputClass}
                placeholder="123456789012345"
                value={form.whatsapp_business_account_id}
                onChange={(e) => setField('whatsapp_business_account_id', e.target.value.replace(/[^0-9]/g, ''))}
                inputMode="numeric"
              />
            </Field>

            <Field label={t.wa_default_cc ?? 'Default country code'} hint={t.wa_default_cc_hint ?? 'Calling code (digits only, e.g. 212) used for customer numbers saved without one.'}>
              <input
                className={inputClass}
                placeholder="212"
                value={form.whatsapp_default_country_code}
                onChange={(e) => setField('whatsapp_default_country_code', e.target.value.replace(/[^0-9]/g, ''))}
                inputMode="numeric"
              />
            </Field>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleTest}
                disabled={testing || saving}
                className="inline-flex items-center gap-2 rounded-[5px] border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
              >
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {testing ? (t.wa_testing ?? 'Testing\u2026') : (t.wa_test ?? 'Test connection')}
              </button>
              <p className="text-xs text-zinc-500">
                {t.wa_test_hint ?? 'Tests the saved credentials. Save first if you just changed them.'}
              </p>
            </div>
          </>
        )}
      </div>

      <div className="mt-5 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-[5px] bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? (t.saving ?? 'Saving…') : (t.save_btn ?? 'Save Integrations')}
        </button>
      </div>
    </>
  );
}

function SeoSection() {
  const t = useDictionary()?.admin?.settings?.seo ?? {};
  const { form, setField, save, dirty, loading } = useStoreSettings({
    seo_site_name: '',
    seo_site_url: '',
    seo_favicon: '',
    seo_default_title: '',
    seo_title_template: '%s | %site%',
    seo_default_description: '',
    seo_default_keywords: '',
    seo_og_title: '',
    seo_og_description: '',
    seo_og_image: '',
    seo_twitter_card: 'summary_large_image',
    seo_twitter_site: '',
    seo_default_index: 'true',
    seo_default_follow: 'true',
  });

  if (loading) return <AdminSettingsSkeleton />;

  const siteName = form.seo_site_name?.trim();
  const previewTitle = form.seo_default_title?.trim() || siteName || 'My store';
  const previewUrl = (form.seo_site_url?.trim() || 'https://example.com').replace(/\/+$/, '');
  const previewDesc =
    form.seo_default_description?.trim() ||
    (t.no_description ?? 'Add a default meta description so search engines have something to show.');
  const socialTitle = form.seo_og_title?.trim() || previewTitle;
  const socialDesc = form.seo_og_description?.trim() || previewDesc;

  const Toggle = ({ field, label, hint }) => {
    const on = form[field] !== 'false';
    return (
      <Field label={label} hint={hint}>
        <button
          type="button"
          onClick={() => setField(field, on ? 'false' : 'true')}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${on ? 'bg-blue-600' : 'bg-zinc-300'}`}
          aria-pressed={on}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </Field>
    );
  };

  return (
    <>
      <SectionHeader title={t.title ?? 'SEO'} description={t.desc ?? 'Control how your store appears in search engines and when shared on social media.'} />

      <GroupHeader title={t.identity ?? 'Site identity'} description={t.identity_hint} icon={Store} />
      <Field label={t.site_name ?? 'Site / company name'} hint={t.site_name_hint ?? 'Used as the default title and in social share cards.'}>
        <input className={inputClass} value={form.seo_site_name} onChange={(e) => setField('seo_site_name', e.target.value)} placeholder="My store" />
      </Field>
      <Field label={t.site_url ?? 'Site URL'} hint={t.site_url_hint ?? 'The canonical public address, e.g. https://mystore.com. Falls back to the deployment URL.'}>
        <input className={inputClass} value={form.seo_site_url} onChange={(e) => setField('seo_site_url', e.target.value)} placeholder="https://mystore.com" />
      </Field>
      <Field label={t.favicon ?? 'Favicon URL'} hint={t.favicon_hint ?? 'Small icon shown in browser tabs and search results.'}>
        <input className={inputClass} value={form.seo_favicon} onChange={(e) => setField('seo_favicon', e.target.value)} placeholder="https://…/favicon.ico" />
      </Field>

      <GroupHeader title={t.search_appearance ?? 'Search appearance'} description={t.search_appearance_hint} icon={Search} />
      <Field label={t.default_title ?? 'Default SEO title'} hint={t.default_title_hint ?? 'Used for the homepage and any page without its own title.'}>
        <input className={inputClass} value={form.seo_default_title} onChange={(e) => setField('seo_default_title', e.target.value)} placeholder={siteName || 'My store'} />
      </Field>
      <Field label={t.title_template ?? 'Title template'} hint={t.title_template_hint ?? 'How page titles are framed. %s = page title, %site% = site name.'}>
        <input className={inputClass} value={form.seo_title_template} onChange={(e) => setField('seo_title_template', e.target.value)} placeholder="%s | %site%" />
      </Field>
      <Field label={t.default_description ?? 'Default meta description'} hint={t.default_description_hint ?? 'Shown under the title in search results (aim for 70–160 characters).'}>
        <textarea className={`${inputClass} resize-none`} rows={3} value={form.seo_default_description} onChange={(e) => setField('seo_default_description', e.target.value)} />
      </Field>
      <Field label={t.default_keywords ?? 'Default keywords'} hint={t.default_keywords_hint ?? 'Optional, comma-separated. Used for internal organization — not a ranking factor.'}>
        <input className={inputClass} value={form.seo_default_keywords} onChange={(e) => setField('seo_default_keywords', e.target.value)} placeholder="shoes, sneakers, running" />
      </Field>

      <div className="mt-4">
        <p className="text-xs font-medium text-zinc-500 mb-2">{t.search_preview ?? 'Search result preview'}</p>
        <SeoSearchPreview title={previewTitle} url={previewUrl} description={previewDesc} favicon={form.seo_favicon} />
      </div>

      <GroupHeader title={t.social ?? 'Social sharing (Open Graph / X)'} description={t.social_hint} icon={Share2} />
      <Field label={t.og_title ?? 'Default OG title'} hint={t.og_title_hint ?? 'Defaults to the SEO title when empty.'}>
        <input className={inputClass} value={form.seo_og_title} onChange={(e) => setField('seo_og_title', e.target.value)} placeholder={previewTitle} />
      </Field>
      <Field label={t.og_description ?? 'Default OG description'} hint={t.og_description_hint ?? 'Defaults to the meta description when empty.'}>
        <textarea className={`${inputClass} resize-none`} rows={2} value={form.seo_og_description} onChange={(e) => setField('seo_og_description', e.target.value)} />
      </Field>
      <Field label={t.og_image ?? 'Default OG image URL'} hint={t.og_image_hint ?? 'Shown when your store is shared. Recommended 1200×630.'}>
        <input className={inputClass} value={form.seo_og_image} onChange={(e) => setField('seo_og_image', e.target.value)} placeholder="https://…/share.jpg" />
      </Field>
      <Field label={t.twitter_card ?? 'X (Twitter) card type'}>
        <select className={inputClass} value={form.seo_twitter_card} onChange={(e) => setField('seo_twitter_card', e.target.value)}>
          <option value="summary_large_image">{t.card_large ?? 'Large image'}</option>
          <option value="summary">{t.card_summary ?? 'Summary'}</option>
        </select>
      </Field>
      <Field label={t.twitter_site ?? 'X (Twitter) handle'} hint={t.twitter_site_hint ?? 'e.g. @mystore'}>
        <input className={inputClass} value={form.seo_twitter_site} onChange={(e) => setField('seo_twitter_site', e.target.value)} placeholder="@mystore" />
      </Field>

      <div className="mt-4">
        <p className="text-xs font-medium text-zinc-500 mb-2">{t.social_preview ?? 'Social share preview'}</p>
        <SeoSocialPreview title={socialTitle} description={socialDesc} image={form.seo_og_image} siteName={siteName} url={previewUrl} />
      </div>

      <GroupHeader title={t.indexing ?? 'Search engine indexing'} description={t.indexing_hint} icon={Globe} />
      <Toggle field="seo_default_index" label={t.allow_index ?? 'Allow search engines to index the store'} hint={t.allow_index_hint ?? 'Turn off to keep the whole store out of search results.'} />
      <Toggle field="seo_default_follow" label={t.allow_follow ?? 'Allow search engines to follow links'} hint={t.allow_follow_hint} />

      <SectionSaveButton onSave={save} dirty={dirty} />
    </>
  );
}

function LocalizationSection() {
  const t = useDictionary()?.admin?.settings?.localization ?? {};
  const { form, setField, save, dirty, loading } = useStoreSettings({
    localization_default_language: 'en',
    localization_timezone: 'Africa/Casablanca',
  });

  if (loading) return <AdminSettingsSkeleton />;

  return (
    <>
      <SectionHeader title={t.title} description={t.desc} />
      <Field label={t.default_language} hint={t.default_language_hint ?? 'Language used when a visitor has no saved preference.'}>
        <select
          className={inputClass}
          value={form.localization_default_language}
          onChange={(e) => setField('localization_default_language', e.target.value)}
        >
          <option value="en">English</option>
          <option value="fr">Français</option>
          <option value="ar">العربية</option>
          <option value="dr">Darija</option>
        </select>
      </Field>
      <Field label={t.timezone} hint={t.timezone_hint ?? 'Used when displaying order and report timestamps.'}>
        <select
          className={inputClass}
          value={form.localization_timezone}
          onChange={(e) => setField('localization_timezone', e.target.value)}
        >
          <option value="UTC">UTC</option>
          <option value="Africa/Casablanca">Africa/Casablanca</option>
          <option value="Europe/Paris">Europe/Paris</option>
        </select>
      </Field>
      <SectionSaveButton onSave={save} dirty={dirty} />
    </>
  );
}

// ── Hero type definitions ─────────────────────────────────────────────────
/** Returns a fresh per-locale translation bucket for hero text fields. */
const mkTrans = () => Object.fromEntries(Object.keys(localeMetadata).map((l) => [l, {}]));

const HERO_TYPES = [
  { value: 'slider',    label: 'Slider',       icon: Layers,         desc: 'Multi-slide cinematic carousel' },
  { value: 'single',   label: 'Single Image',  icon: ImageIcon,      desc: 'Static full-viewport image' },
  { value: 'multi',    label: 'Multi-Image',   icon: LayoutGrid,     desc: 'Gallery with auto-rotation' },
  { value: 'iherb',    label: 'iHerb Style',   icon: LayoutTemplate, desc: 'Responsive hero + side promo cards' },
  { value: 'video',    label: 'Video Hero',    icon: Film,           desc: 'Full-screen video background' },
  { value: 'countdown',label: 'Countdown',     icon: Timer,          desc: 'Animated countdown timer' },
];

function HeroSection() {
  const t = (useDictionary()?.admin?.settings?.hero) ?? {};

  // ── State ────────────────────────────────────────────────────────────
  const [heroType, setHeroType]         = useState('slider');
  const [activeLang, setActiveLang]     = useState('en');
  const [slides, setSlides]             = useState([]);
  const [singleCfg, setSingleCfg]       = useState({ image_url: '', overlay_opacity: 40, text_align: 'center', cta_href: '/shop', translations: mkTrans() });
  const [multiCfg, setMultiCfg]         = useState({ auto_rotate: true, rotation_interval: 4000, overlay_opacity: 40, cta_href: '/shop', translations: mkTrans() });
  const [iherbCfg, setIherbCfg]         = useState({ main_image_url: '', main_cta_href: '/shop', text_align: 'left', overlay_opacity: 0, side_cards: [], mobile_position: 'behind', autoplay: false, autoplay_interval: 5, translations: mkTrans() });
  const [videoCfg, setVideoCfg]         = useState({ video_url: '', autoplay: true, loop: true, muted: true, poster_url: '', overlay_opacity: 40, cta_href: '/shop', translations: mkTrans() });
  const [countdownCfg, setCountdownCfg] = useState({ background_type: 'image', background_url: '', countdown_end: '', expired_behavior: 'hide', overlay_opacity: 40, cta_href: '/shop', translations: mkTrans() });
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [uploading, setUploading]       = useState({});
  const [uploadingKey, setUploadingKey] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

  // ── Load ─────────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      fetch('/api/v1/admin/hero-slides').then((r) => r.json()).catch(() => ({ success: false, data: [] })),
      fetch('/api/v1/settings').then((r) => r.json()).catch(() => ({ success: false, data: [] })),
    ]).then(([slidesJson, settingsJson]) => {
      if (slidesJson.success) {
        // Migrate flat title/cta_text → translations.en; ensure all locale buckets exist
        setSlides((slidesJson.data ?? []).map(slide => {
          const trans = { ...mkTrans(), ...(slide.translations ?? {}) };
          if ((slide.title || slide.cta_text) && !trans.en?.title) {
            trans.en = { title: slide.title ?? '', cta_text: slide.cta_text ?? '', ...(trans.en ?? {}) };
          }
          return { ...slide, translations: trans };
        }));
      }
      if (settingsJson.success) {
        const s = settingsJson.data ?? {};
        if (s.hero_type) setHeroType(s.hero_type);
        const TEXT_FIELDS = ['title', 'description', 'cta_text', 'expired_message'];
        const tryParse = (key, setter) => {
          try {
            if (!s[key]) return;
            const parsed = JSON.parse(s[key]);
            // Migrate old flat text fields into translations.en
            const trans = { ...mkTrans(), ...(parsed.translations ?? {}) };
            if (TEXT_FIELDS.some(f => parsed[f]) && !trans.en?.title) {
              trans.en = { ...Object.fromEntries(TEXT_FIELDS.filter(f => parsed[f]).map(f => [f, parsed[f]])), ...(trans.en ?? {}) };
              TEXT_FIELDS.forEach(f => delete parsed[f]);
            }
            parsed.translations = trans;
            setter(prev => ({ ...prev, ...parsed }));
          } catch {}
        };
        tryParse('hero_single_config',    setSingleCfg);
        tryParse('hero_multi_config',     setMultiCfg);
        tryParse('hero_iherb_config',     setIherbCfg);
        tryParse('hero_video_config',     setVideoCfg);
        tryParse('hero_countdown_config', setCountdownCfg);
      }
    }).finally(() => setLoading(false));
  }, []);

  // ── Slide helpers ────────────────────────────────────────────────────
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
      { image_url: '', href: '/shop', is_active: true, translations: mkTrans() },
    ]);

  const remove = (idx) => {
    setSlides((prev) => prev.filter((_, i) => i !== idx));
    setConfirmDelete(null);
  };

  // ── Upload helpers ────────────────────────────────────────────────────
  const uploadFile = async (file, folder) => {
    const supabase = createClient();
    const ext = file.name.split('.').pop();
    const path = `${folder}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('hero-images').upload(path, file, { upsert: true });
    if (error) throw error;
    return supabase.storage.from('hero-images').getPublicUrl(path).data.publicUrl;
  };

  const handleSlideImageUpload = async (idx, file) => {
    if (!file) return;
    setUploading((prev) => ({ ...prev, [idx]: true }));
    try {
      const url = await uploadFile(file, 'hero/slides');
      update(idx, 'image_url', url);
    } catch (err) {
      toast.error((t.upload_error ?? 'Upload failed') + ': ' + (err?.message ?? ''));
    } finally {
      setUploading((prev) => ({ ...prev, [idx]: false }));
    }
  };

  const handleSpecialUpload = async (key, setter, field, file, folder) => {
    if (!file) return;
    setUploadingKey((prev) => ({ ...prev, [key]: true }));
    try {
      const url = await uploadFile(file, folder);
      setter((prev) => ({ ...prev, [field]: url }));
    } catch (err) {
      toast.error((t.upload_error ?? 'Upload failed') + ': ' + (err?.message ?? ''));
    } finally {
      setUploadingKey((prev) => ({ ...prev, [key]: false }));
    }
  };

  // ── Locale-aware text helpers ─────────────────────────────────────────
  const getTxt = (cfg, field) => cfg?.translations?.[activeLang]?.[field] ?? '';
  const setTxt = (setter, field) => (e) =>
    setter(prev => ({
      ...prev,
      translations: {
        ...mkTrans(),
        ...(prev.translations ?? {}),
        [activeLang]: { ...(prev.translations?.[activeLang] ?? {}), [field]: e.target.value }
      }
    }));
  const setSlideTxt = (idx, field) => (e) =>
    setSlides(prev => prev.map((s, i) => i !== idx ? s : {
      ...s,
      translations: {
        ...mkTrans(),
        ...(s.translations ?? {}),
        [activeLang]: { ...(s.translations?.[activeLang] ?? {}), [field]: e.target.value }
      }
    }));

  // ── iHerb side-card helpers ───────────────────────────────────────────
  const getCardTxt = (card, field) => card?.translations?.[activeLang]?.[field] ?? '';
  const setCardTxt = (idx, field) => (e) =>
    setIherbCfg(prev => ({
      ...prev,
      side_cards: prev.side_cards.map((c, i) => i !== idx ? c : {
        ...c,
        translations: {
          ...mkTrans(),
          ...(c.translations ?? {}),
          [activeLang]: { ...(c.translations?.[activeLang] ?? {}), [field]: e.target.value }
        }
      })
    }));
  const updateCard = (idx, field, value) =>
    setIherbCfg(prev => ({
      ...prev,
      side_cards: prev.side_cards.map((c, i) => i !== idx ? c : { ...c, [field]: value })
    }));
  const addCard = () =>
    setIherbCfg(prev => ({
      ...prev,
      side_cards: [...(prev.side_cards ?? []), { image_url: '', href: '/shop', translations: mkTrans() }]
    }));
  const removeCard = (idx) =>
    setIherbCfg(prev => ({
      ...prev,
      side_cards: prev.side_cards.filter((_, i) => i !== idx)
    }));
  const handleCardImageUpload = async (idx, file) => {
    if (!file) return;
    setUploadingKey((prev) => ({ ...prev, [`iherb_card_${idx}`]: true }));
    try {
      const url = await uploadFile(file, 'hero/iherb');
      updateCard(idx, 'image_url', url);
    } catch (err) {
      toast.error((t.upload_error ?? 'Upload failed') + ': ' + (err?.message ?? ''));
    } finally {
      setUploadingKey((prev) => ({ ...prev, [`iherb_card_${idx}`]: false }));
    }
  };

  // ── Save ─────────────────────────────────────────────────────────────
  const save = async () => {
    setSaving(true);
    try {
      const configMap = {
        single:    ['hero_single_config',    singleCfg],
        multi:     ['hero_multi_config',     multiCfg],
        iherb:     ['hero_iherb_config',     iherbCfg],
        video:     ['hero_video_config',     videoCfg],
        countdown: ['hero_countdown_config', countdownCfg],
      };
      const settingsBody = { hero_type: heroType };
      if (configMap[heroType]) {
        const [cfgKey, cfgVal] = configMap[heroType];
        settingsBody[cfgKey] = JSON.stringify(cfgVal);
      }
      const settingsRes = await fetch('/api/v1/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsBody),
      });
      if (!settingsRes.ok) throw new Error('Settings save failed');

      if (heroType === 'slider' || heroType === 'multi') {
        const slidesRes = await fetch('/api/v1/admin/hero-slides', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slides }),
        });
        const slidesJson = await slidesRes.json();
        if (!slidesJson.success) throw new Error(slidesJson.error ?? 'Slides save failed');
      }

      toast.success(t.saved ?? 'Hero settings saved');
    } catch (err) {
      toast.error(err?.message ?? 'Failed to save');
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

  // ── Image upload tile ────────────────────────────────────────────────
  const ImageTile = ({ imageUrl, isUploading, onUpload, onDelete, onPreview, hint }) => (
    <div
      className={`relative flex flex-col items-center justify-center w-full rounded-xl border-2 border-dashed overflow-hidden transition-colors ${imageUrl ? 'border-transparent' : 'border-zinc-200 bg-zinc-50 hover:border-blue-400 hover:bg-blue-50'}`}
      style={{ minHeight: '10rem' }}
    >
      {isUploading ? (
        <div className="flex flex-col items-center gap-2 py-8 text-zinc-400">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-sm">{t.uploading ?? 'Uploading…'}</span>
        </div>
      ) : imageUrl ? (
        <div className="w-full space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="" className="w-full h-40 object-cover rounded-xl" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          <div className="flex flex-wrap items-center gap-2">
            {onPreview && (
              <button type="button" onClick={(e) => { e.preventDefault(); onPreview(imageUrl); }}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-zinc-700 text-sm font-medium hover:bg-zinc-50">
                <Maximize2 className="h-4 w-4" /> {t.preview_image ?? 'Preview'}
              </button>
            )}
            <label className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-zinc-700 text-sm font-medium hover:bg-zinc-50 cursor-pointer">
              <ImageIcon className="h-4 w-4" /> {t.change_image ?? 'Change'}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => onUpload(e.target.files?.[0])} />
            </label>
            {onDelete && (
              <button type="button" onClick={(e) => { e.preventDefault(); onDelete(); }}
                className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-600 text-sm font-medium hover:bg-red-100">
                <Trash2 className="h-4 w-4" /> {t.remove_image ?? 'Remove'}
              </button>
            )}
          </div>
        </div>
      ) : (
        <label className="flex flex-col items-center gap-2 py-8 text-zinc-400 cursor-pointer w-full h-full justify-center">
          <ImageIcon className="h-8 w-8" />
          <span className="text-sm font-medium">{hint ?? t.image_label ?? 'Click to upload image'}</span>
          <span className="text-xs">JPG, PNG, WebP</span>
          <input type="file" accept="image/*" className="hidden" onChange={(e) => onUpload(e.target.files?.[0])} />
        </label>
      )}
    </div>
  );

  // ── Overlay slider ────────────────────────────────────────────────────
  const OverlaySlider = ({ value, onChange }) => (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-zinc-700">{t.lbl_overlay_opacity ?? 'Overlay opacity'}</span>
        <span className="text-xs font-semibold text-zinc-500 tabular-nums w-12 text-right">{value}%</span>
      </div>
      <input type="range" min={0} max={90} step={5} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full accent-blue-600" />
    </div>
  );

  // ── Text-align picker ─────────────────────────────────────────────────
  const AlignPicker = ({ value, onChange }) => (
    <div className="flex items-center gap-0 border border-zinc-200 rounded-lg overflow-hidden w-fit">
      {[['left', AlignLeft], ['center', AlignCenter], ['right', AlignRight]].map(([val, Icon]) => (
        <button key={val} type="button" onClick={() => onChange(val)}
          className={`flex items-center justify-center h-8 w-9 transition-colors ${value === val ? 'bg-blue-600 text-white' : 'bg-white text-zinc-500 hover:bg-zinc-50'}`}>
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  );

  // ── Locale tab bar ────────────────────────────────────────────────────
  const RTL_LANGS = new Set(['ar', 'dr']);
  const inputDir  = RTL_LANGS.has(activeLang) ? 'rtl' : 'ltr';
  const LocaleTabBar = () => (
    <div className="flex items-center gap-1 border-b border-zinc-100 mb-3 -mx-4 px-4 pt-1">
      {Object.entries(localeMetadata).map(([lang, meta]) => (
        <button key={lang} type="button" onClick={() => setActiveLang(lang)}
          className={`px-3 py-1.5 text-[11px] font-bold rounded-t border-b-2 -mb-px transition-colors uppercase tracking-wider ${
            activeLang === lang ? 'border-blue-600 text-blue-700 bg-blue-50/60' : 'border-transparent text-zinc-400 hover:text-zinc-700'
          }`}>
          {lang.toUpperCase()}
          {meta.dir === 'rtl' && <span className="ml-1 text-[9px] opacity-60">&#x202B;</span>}
        </button>
      ))}
    </div>
  );

  return (
    <>
      <SectionHeader
        title={t.section_title ?? "Hero Section"}
        description={t.section_desc ?? "Choose a hero type and configure it. Slides are shared between Slider and Multi-Image heroes."}
      />

      {/* ── Type selector ────────────────────────────────────────────── */}
      <div className="mb-6">
        <p className="text-sm font-medium text-zinc-700 mb-3">{t.type_label ?? "Hero Type"}</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {HERO_TYPES.map((ht) => {
            const Icon = ht.icon;
            const active = heroType === ht.value;
            const label = t[`type_${ht.value}`] ?? ht.label;
            const desc  = t[`type_${ht.value}_desc`] ?? ht.desc;
            return (
              <button key={ht.value} type="button" onClick={() => setHeroType(ht.value)}
                className={`flex flex-col items-start gap-2 rounded-xl border-2 p-3 text-left transition-all ${active ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-200' : 'border-zinc-200 bg-white hover:border-zinc-300'}`}>
                <Icon className={`h-5 w-5 ${active ? 'text-blue-600' : 'text-zinc-400'}`} />
                <div>
                  <p className={`text-xs font-semibold leading-tight ${active ? 'text-blue-700' : 'text-zinc-800'}`}>{label}</p>
                  <p className="text-[11px] text-zinc-400 leading-snug mt-0.5 hidden sm:block">{desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Single Image settings ─────────────────────────────────────── */}
      {heroType === 'single' && (
        <div className="space-y-4 border border-zinc-200 rounded-xl p-4 mb-4">
          <p className="text-sm font-semibold text-zinc-700">{t.panel_single ?? "Single Image Hero"}</p>
          <ImageTile
            imageUrl={singleCfg.image_url}
            isUploading={uploadingKey.single_img}
            onUpload={(f) => handleSpecialUpload('single_img', setSingleCfg, 'image_url', f, 'hero/single')}
            onDelete={() => setSingleCfg((p) => ({ ...p, image_url: '' }))}
            onPreview={setPreviewImage}
          />
          <LocaleTabBar />
          <input className={inputClass} dir={inputDir} placeholder={t.ph_title_uppercase ?? "Title (optional, uppercase)"}
            value={getTxt(singleCfg, 'title')} onChange={setTxt(setSingleCfg, 'title')} />
          <textarea className={`${inputClass} resize-none`} dir={inputDir} rows={2} placeholder={t.ph_desc_optional ?? "Description (optional)"}
            value={getTxt(singleCfg, 'description')} onChange={setTxt(setSingleCfg, 'description')} />
          <div className="grid grid-cols-2 gap-3">
            <input className={inputClass} dir={inputDir} placeholder={t.ph_cta_text_shop ?? "CTA text (e.g. SHOP NOW)"}
              value={getTxt(singleCfg, 'cta_text')} onChange={setTxt(setSingleCfg, 'cta_text')} />
            <input className={inputClass} placeholder={t.ph_cta_link ?? "CTA link (e.g. /shop)"} value={singleCfg.cta_href}
              onChange={(e) => setSingleCfg((p) => ({ ...p, cta_href: e.target.value }))} />
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-700 shrink-0">{t.lbl_text_align ?? "Text align"}</span>
            <AlignPicker value={singleCfg.text_align} onChange={(v) => setSingleCfg((p) => ({ ...p, text_align: v }))} />
          </div>
          <OverlaySlider value={singleCfg.overlay_opacity} onChange={(v) => setSingleCfg((p) => ({ ...p, overlay_opacity: v }))} />
        </div>
      )}

      {/* ── Video Hero settings ───────────────────────────────────────── */}
      {heroType === 'video' && (
        <div className="space-y-4 border border-zinc-200 rounded-xl p-4 mb-4">
          <p className="text-sm font-semibold text-zinc-700">{t.panel_video ?? "Video Hero"}</p>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">{t.video_url_label ?? "Video URL (Supabase storage)"}</label>
            <div className="flex items-center gap-2">
              <Film className="h-4 w-4 text-zinc-400 shrink-0" />
              <input className={inputClass} placeholder="https://…/video.mp4" value={videoCfg.video_url}
                onChange={(e) => setVideoCfg((p) => ({ ...p, video_url: e.target.value }))} />
            </div>
            <p className="text-[11px] text-zinc-400 mt-1">{t.video_url_hint ?? "Upload your video via the Supabase Storage dashboard, then paste its public URL here."}</p>
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">{t.poster_label ?? "Poster image (shown while video loads)"}</label>
            <ImageTile
              imageUrl={videoCfg.poster_url}
              isUploading={uploadingKey.poster}
              onUpload={(f) => handleSpecialUpload('poster', setVideoCfg, 'poster_url', f, 'hero/posters')}
              onDelete={() => setVideoCfg((p) => ({ ...p, poster_url: '' }))}
              onPreview={setPreviewImage}
              hint={t.poster_hint ?? "Upload poster image"}
            />
          </div>
          <LocaleTabBar />
          <input className={inputClass} dir={inputDir} placeholder={t.ph_title_optional ?? "Title (optional)"}
            value={getTxt(videoCfg, 'title')} onChange={setTxt(setVideoCfg, 'title')} />
          <textarea className={`${inputClass} resize-none`} dir={inputDir} rows={2} placeholder={t.ph_desc_optional ?? "Description (optional)"}
            value={getTxt(videoCfg, 'description')} onChange={setTxt(setVideoCfg, 'description')} />
          <div className="grid grid-cols-2 gap-3">
            <input className={inputClass} dir={inputDir} placeholder={t.ph_cta_text ?? "CTA text"}
              value={getTxt(videoCfg, 'cta_text')} onChange={setTxt(setVideoCfg, 'cta_text')} />
            <input className={inputClass} placeholder={t.ph_cta_link ?? "CTA link (e.g. /shop)"} value={videoCfg.cta_href}
              onChange={(e) => setVideoCfg((p) => ({ ...p, cta_href: e.target.value }))} />
          </div>
          <div className="flex flex-wrap items-center gap-6 text-sm text-zinc-700">
            {[['autoplay', t.lbl_autoplay ?? 'Autoplay'], ['loop', t.lbl_loop ?? 'Loop'], ['muted', t.lbl_muted ?? 'Muted']].map(([field, label]) => (
              <label key={field} className="flex items-center gap-2 cursor-pointer select-none">
                <Toggle checked={videoCfg[field]} onChange={(v) => setVideoCfg((p) => ({ ...p, [field]: v }))} />
                {label}
              </label>
            ))}
          </div>
          <OverlaySlider value={videoCfg.overlay_opacity} onChange={(v) => setVideoCfg((p) => ({ ...p, overlay_opacity: v }))} />
        </div>
      )}

      {/* ── Countdown Hero settings ───────────────────────────────────── */}
      {heroType === 'countdown' && (
        <div className="space-y-4 border border-zinc-200 rounded-xl p-4 mb-4">
          <p className="text-sm font-semibold text-zinc-700">{t.panel_countdown ?? "Countdown Hero"}</p>
          <div>
            <label className="text-xs text-zinc-500 mb-2 block">{t.cd_bg_type ?? "Background type"}</label>
            <div className="flex items-center gap-3">
              {[['image', t.cd_bg_image ?? 'Image', ImageIcon], ['video', t.cd_bg_video ?? 'Video URL', Film]].map(([val, lbl, Icon]) => (
                <button key={val} type="button" onClick={() => setCountdownCfg((p) => ({ ...p, background_type: val }))}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${countdownCfg.background_type === val ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-zinc-200 text-zinc-600 hover:border-zinc-300'}`}>
                  <Icon className="h-4 w-4" /> {lbl}
                </button>
              ))}
            </div>
          </div>
          {countdownCfg.background_type === 'image' ? (
            <ImageTile
              imageUrl={countdownCfg.background_url}
              isUploading={uploadingKey.countdown_bg}
              onUpload={(f) => handleSpecialUpload('countdown_bg', setCountdownCfg, 'background_url', f, 'hero/countdown')}
              onDelete={() => setCountdownCfg((p) => ({ ...p, background_url: '' }))}
              onPreview={setPreviewImage}
              hint={t.cd_bg_image_hint ?? "Upload background image"}
            />
          ) : (
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">{t.cd_bg_video_label ?? "Video background URL"}</label>
              <input className={inputClass} placeholder="https://…/bg-video.mp4" value={countdownCfg.background_url}
                onChange={(e) => setCountdownCfg((p) => ({ ...p, background_url: e.target.value }))} />
            </div>
          )}
          <LocaleTabBar />
          <input className={inputClass} dir={inputDir} placeholder={t.ph_title_optional ?? "Title (optional)"}
            value={getTxt(countdownCfg, 'title')} onChange={setTxt(setCountdownCfg, 'title')} />
          <textarea className={`${inputClass} resize-none`} dir={inputDir} rows={2} placeholder={t.ph_desc_optional ?? "Description (optional)"}
            value={getTxt(countdownCfg, 'description')} onChange={setTxt(setCountdownCfg, 'description')} />
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">{t.cd_end_label ?? "Countdown end date/time"}</label>
            <input type="datetime-local" className={inputClass}
              value={countdownCfg.countdown_end ? countdownCfg.countdown_end.slice(0, 16) : ''}
              onChange={(e) => setCountdownCfg((p) => ({ ...p, countdown_end: e.target.value ? new Date(e.target.value).toISOString() : '' }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input className={inputClass} dir={inputDir} placeholder={t.ph_cta_text ?? "CTA text"}
              value={getTxt(countdownCfg, 'cta_text')} onChange={setTxt(setCountdownCfg, 'cta_text')} />
            <input className={inputClass} placeholder={t.ph_cta_link ?? "CTA link (e.g. /shop)"} value={countdownCfg.cta_href}
              onChange={(e) => setCountdownCfg((p) => ({ ...p, cta_href: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-2 block">{t.cd_expire_label ?? "When countdown expires"}</label>
            <select className={inputClass} value={countdownCfg.expired_behavior}
              onChange={(e) => setCountdownCfg((p) => ({ ...p, expired_behavior: e.target.value }))}>
              <option value="hide">{t.cd_expire_hide ?? "Hide hero"}</option>
              <option value="show_message">{t.cd_expire_message ?? "Show expired message"}</option>
              <option value="show_hero">{t.cd_expire_hero ?? "Show hero without timer"}</option>
            </select>
          </div>
          {countdownCfg.expired_behavior === 'show_message' && (
            <input className={inputClass} dir={inputDir} placeholder={t.cd_expired_ph ?? "Expired message (e.g. The event has ended)"}
              value={getTxt(countdownCfg, 'expired_message')} onChange={setTxt(setCountdownCfg, 'expired_message')} />
          )}
          <OverlaySlider value={countdownCfg.overlay_opacity} onChange={(v) => setCountdownCfg((p) => ({ ...p, overlay_opacity: v }))} />
        </div>
      )}

      {/* ── Multi-Image global config ─────────────────────────────────── */}
      {heroType === 'multi' && (
        <div className="space-y-4 border border-zinc-200 rounded-xl p-4 mb-4">
          <p className="text-sm font-semibold text-zinc-700">{t.multi_global ?? "Global Settings"}</p>
          <LocaleTabBar />
          <input className={inputClass} dir={inputDir} placeholder={t.ph_title_all_images ?? "Title (optional, overlaid on all images)"}
            value={getTxt(multiCfg, 'title')} onChange={setTxt(setMultiCfg, 'title')} />
          <textarea className={`${inputClass} resize-none`} dir={inputDir} rows={2} placeholder={t.ph_desc_optional ?? "Description (optional)"}
            value={getTxt(multiCfg, 'description')} onChange={setTxt(setMultiCfg, 'description')} />
          <div className="grid grid-cols-2 gap-3">
            <input className={inputClass} dir={inputDir} placeholder={t.ph_cta_text ?? "CTA text"}
              value={getTxt(multiCfg, 'cta_text')} onChange={setTxt(setMultiCfg, 'cta_text')} />
            <input className={inputClass} placeholder={t.ph_cta_link ?? "CTA link"} value={multiCfg.cta_href}
              onChange={(e) => setMultiCfg((p) => ({ ...p, cta_href: e.target.value }))} />
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-zinc-700">
              <Toggle checked={multiCfg.auto_rotate} onChange={(v) => setMultiCfg((p) => ({ ...p, auto_rotate: v }))} />
              {t.lbl_auto_rotate ?? "Auto-rotate"}
            </label>
            {multiCfg.auto_rotate && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-zinc-500 shrink-0">{t.lbl_interval ?? "Interval"}</span>
                <input type="number" min={1000} max={15000} step={500} className={`${inputClass} w-28`}
                  value={multiCfg.rotation_interval}
                  onChange={(e) => setMultiCfg((p) => ({ ...p, rotation_interval: Number(e.target.value) }))} />
                <span className="text-xs text-zinc-400">ms</span>
              </div>
            )}
          </div>
          <OverlaySlider value={multiCfg.overlay_opacity} onChange={(v) => setMultiCfg((p) => ({ ...p, overlay_opacity: v }))} />
        </div>
      )}

      {/* ── iHerb-style hero settings ─────────────────────────────────── */}
      {heroType === 'iherb' && (
        <div className="space-y-4 border border-zinc-200 rounded-xl p-4 mb-4">
          <p className="text-sm font-semibold text-zinc-700">{t.panel_iherb ?? "iHerb Style Hero"}</p>
          <p className="text-xs text-zinc-500">
            {t.panel_iherb_desc ?? "Upload a main banner (mobile + desktop) and up to two side promo cards. The hero height is set by the main banner's aspect ratio so the whole image is always visible."}
          </p>

          <ImageTile
            imageUrl={iherbCfg.main_image_url}
            isUploading={uploadingKey.iherb_main}
            onUpload={(f) => handleSpecialUpload('iherb_main', setIherbCfg, 'main_image_url', f, 'hero/iherb')}
            onDelete={() => setIherbCfg((p) => ({ ...p, main_image_url: '' }))}
            onPreview={setPreviewImage}
            hint={t.iherb_main_hint ?? "Upload main hero banner"}
          />

          <div>
            <label className="text-xs text-zinc-500 mb-2 block">{t.mobile_position ?? "Mobile position"}</label>
            <div className="flex items-center gap-3">
              {[['behind', t.pos_behind ?? 'Behind header'], ['below', t.pos_below ?? 'Below header']].map(([val, lbl]) => (
                <button key={val} type="button" onClick={() => setIherbCfg((p) => ({ ...p, mobile_position: val }))}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${iherbCfg.mobile_position === val ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-zinc-200 text-zinc-600 hover:border-zinc-300'}`}>
                  {lbl}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-zinc-400 mt-1">{t.mobile_position_hint ?? "Choose how the hero sits relative to the fixed header on mobile only. Desktop always shows below header."}</p>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={!!iherbCfg.autoplay}
                onChange={(e) => setIherbCfg((p) => ({ ...p, autoplay: e.target.checked }))}
                className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
              />
              {t.auto_move ?? "Auto-move slides"}
            </label>
            {iherbCfg.autoplay && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-zinc-500">{t.time_between ?? "Time between slides"}</span>
                <input
                  type="number" min={1} max={30} step={1}
                  value={iherbCfg.autoplay_interval ?? 5}
                  onChange={(e) => setIherbCfg((p) => ({ ...p, autoplay_interval: Math.max(1, Math.min(30, Number(e.target.value) || 5)) }))}
                  className="w-20 rounded-lg border border-zinc-200 px-2 py-1 text-sm"
                />
                <span className="text-xs text-zinc-500">{t.seconds ?? "seconds"}</span>
              </div>
            )}
            <p className="text-[11px] text-zinc-400 mt-1">{t.auto_move_hint ?? "Automatically advance to the next slide/set. Applies to both mobile and desktop."}</p>
          </div>

          <LocaleTabBar />
          <input className={inputClass} dir={inputDir} placeholder={t.ph_title_banner ?? "Title (optional, overlaid on banner)"}
            value={getTxt(iherbCfg, 'title')} onChange={setTxt(setIherbCfg, 'title')} />
          <textarea className={`${inputClass} resize-none`} dir={inputDir} rows={2} placeholder={t.ph_desc_banner ?? "Description (optional, overlaid on banner)"}
            value={getTxt(iherbCfg, 'description')} onChange={setTxt(setIherbCfg, 'description')} />
          <div className="grid grid-cols-2 gap-3">
            <input className={inputClass} dir={inputDir} placeholder={t.ph_cta_text ?? "CTA text"}
              value={getTxt(iherbCfg, 'cta_text')} onChange={setTxt(setIherbCfg, 'cta_text')} />
            <input className={inputClass} placeholder={t.ph_cta_link ?? "CTA link (e.g. /shop)"} value={iherbCfg.main_cta_href}
              onChange={(e) => setIherbCfg((p) => ({ ...p, main_cta_href: e.target.value }))} />
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-700 shrink-0">{t.lbl_text_align ?? "Text align"}</span>
            <AlignPicker value={iherbCfg.text_align} onChange={(v) => setIherbCfg((p) => ({ ...p, text_align: v }))} />
          </div>
          <OverlaySlider value={iherbCfg.overlay_opacity} onChange={(v) => setIherbCfg((p) => ({ ...p, overlay_opacity: v }))} />

          {/* Side cards */}
          <div className="pt-4 border-t border-zinc-100 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-zinc-700">{t.side_cards_title ?? "Side Promo Cards"}</p>
              <span className="text-xs text-zinc-400">{(iherbCfg.side_cards ?? []).length}</span>
            </div>
            {(iherbCfg.side_cards ?? []).length === 0 && (
              <p className="text-sm text-zinc-400 text-center py-4">{t.side_cards_empty ?? "No side cards. Add one to show the desktop side layout."}</p>
            )}
            {(iherbCfg.side_cards ?? []).map((card, idx) => (
              <div key={idx} className="border border-zinc-200 rounded-xl p-3 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">{t.card ?? "Card"} {idx + 1}</span>
                  <button onClick={() => removeCard(idx)} className="p-1 rounded text-red-400 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <ImageTile
                  imageUrl={card.image_url}
                  isUploading={uploadingKey[`iherb_card_${idx}`]}
                  onUpload={(f) => handleCardImageUpload(idx, f)}
                  onDelete={() => updateCard(idx, 'image_url', '')}
                  onPreview={setPreviewImage}
                  hint={t.card_image_hint ?? "Upload promo card image"}
                />
                <input className={inputClass} dir={inputDir} placeholder={t.card_title_ph ?? "Card title (optional)"}
                  value={getCardTxt(card, 'title')} onChange={setCardTxt(idx, 'title')} />
                <input className={inputClass} placeholder={t.card_link_ph ?? "Card link (e.g. /shop)"} value={card.href}
                  onChange={(e) => updateCard(idx, 'href', e.target.value)} />
              </div>
            ))}
            <button onClick={addCard} className="flex items-center gap-2 rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
              <Plus className="h-4 w-4" /> {t.add_side_card ?? "Add Side Card"}
            </button>
          </div>
        </div>
      )}

      {/* ── Slides list (Slider & Multi-Image) ───────────────────────── */}
      {(heroType === 'slider' || heroType === 'multi') && (
        <>
          <LocaleTabBar />
          <div className="flex flex-col gap-4 mb-4">
            {slides.length === 0 && (
              <p className="text-sm text-zinc-400 text-center py-8">{t.no_slides ?? 'No slides yet. Add one below.'}</p>
            )}
            {slides.map((slide, idx) => (
              <div key={idx} className="border border-zinc-200 rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">{t.slide ?? 'Slide'} {idx + 1}</span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => move(idx, -1)} disabled={idx === 0} className="p-1 rounded text-zinc-400 hover:text-zinc-700 disabled:opacity-30">
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button onClick={() => move(idx, 1)} disabled={idx === slides.length - 1} className="p-1 rounded text-zinc-400 hover:text-zinc-700 disabled:opacity-30">
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    <button onClick={() => setConfirmDelete(idx)} className="p-1 rounded text-red-400 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <ImageTile
                  imageUrl={slide.image_url}
                  isUploading={uploading[idx]}
                  onUpload={(f) => handleSlideImageUpload(idx, f)}
                  onPreview={setPreviewImage}
                />

                <input className={inputClass} dir={inputDir}
                  placeholder={t.title_placeholder ?? 'Title (e.g. THE LUXURY YOU DESERVE)'}
                  value={slide.translations?.[activeLang]?.title ?? ''}
                  onChange={setSlideTxt(idx, 'title')} />
                <div className="grid grid-cols-2 gap-3">
                  <input className={inputClass} dir={inputDir}
                    placeholder={t.cta_placeholder ?? 'Button text (e.g. SHOP NOW)'}
                    value={slide.translations?.[activeLang]?.cta_text ?? ''}
                    onChange={setSlideTxt(idx, 'cta_text')} />
                  <input className={inputClass} placeholder={t.link_placeholder ?? 'Link path (e.g. /shop)'}
                    value={slide.href} onChange={(e) => update(idx, 'href', e.target.value)} />
                </div>
                <div className="flex items-center gap-2">
                  <Toggle defaultChecked={slide.is_active} onChange={(val) => update(idx, 'is_active', val)} />
                  <span className="text-sm text-zinc-600">{t.active ?? 'Active'}</span>
                </div>
              </div>
            ))}
          </div>
          <button onClick={add} className="flex items-center gap-2 rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 mb-4">
            <Plus className="h-4 w-4" /> {t.add_slide ?? 'Add Slide'}
          </button>
        </>
      )}

      {/* ── Save button ──────────────────────────────────────────────── */}
      <div className="flex justify-end pt-2 border-t border-zinc-100">
        <button onClick={save} disabled={saving}
          className="flex items-center gap-2 rounded-[5px] bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? (t.saving ?? 'Saving…') : (t.save_hero ?? 'Save Hero Settings')}
        </button>
      </div>

      {/* ── Fullscreen image preview portal ─────────────────────────── */}
      {previewImage && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setPreviewImage(null)}>
          <button onClick={() => setPreviewImage(null)}
            className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="Close preview">
            <XIcon className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewImage} alt="Hero preview" onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] max-w-full rounded-xl object-contain shadow-2xl" />
        </div>,
        document.body
      )}

      {/* ── Delete confirmation ──────────────────────────────────────── */}
      <ConfirmationDialog
        isOpen={confirmDelete !== null}
        title={t.dialog_title ?? 'Delete Slide'}
        description={t.dialog_desc ?? 'Are you sure you want to delete this slide? This action cannot be undone.'}
        confirmText={t.yes ?? 'Yes, delete'}
        cancelText={t.no ?? 'Cancel'}
        icon={<Trash2 className="h-5 w-5" />}
        onConfirm={() => remove(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
    </>
  );
}

function Toggle({ defaultChecked = false, checked: controlledChecked, onChange, disabled = false, loading = false }) {
  const isControlled = controlledChecked !== undefined;
  const [internalOn, setInternalOn] = useState(defaultChecked);
  const on = isControlled ? controlledChecked : internalOn;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled || loading}
      onClick={() => {
        if (disabled || loading) return;
        const next = !on;
        if (!isControlled) setInternalOn(next);
        onChange?.(next);
      }}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-0 p-0 transition-colors ${
        on ? "bg-blue-600" : "bg-zinc-300"
      } ${disabled || loading ? 'opacity-60 cursor-not-allowed' : ''}`}
    >
      {loading ? (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
        </span>
      ) : (
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            on ? "translate-x-6 rtl:-translate-x-6" : "translate-x-1 rtl:-translate-x-1"
          }`}
        />
      )}
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

/**
 * Scope id → user-facing label fallback. The dictionary key (`scope_<id>`)
 * always wins when present so the admin can translate page names.
 */
const SCOPE_LABEL_FALLBACKS = {
  all:               'All pages',
  home:              'Home',
  product:           'Product page',
  cart:              'Cart',
  checkout:          'Checkout',
  favorites:         'Favorites',
  account:           'Account',
  orders:            'Orders',
  'order-confirmed': 'Order confirmed',
  'track-order':     'Track order',
  invoice:           'Invoice',
  login:             'Login',
  signup:            'Sign up',
};

function scopeLabel(t, scope) {
  const id = scope || 'all';
  const key = `scope_${id.replace(/-/g, '_')}`;
  return t?.[key] ?? SCOPE_LABEL_FALLBACKS[id] ?? id;
}

/** Selectable page ids (excludes the special 'all'). */
const SCOPE_PAGE_IDS = [
  'home', 'product', 'cart', 'checkout', 'favorites', 'account',
  'orders', 'order-confirmed', 'track-order', 'invoice', 'login', 'signup',
];

/** Normalize an announcement to its effective list of target scopes. */
function effectiveScopes(a) {
  const arr = Array.isArray(a?.scopes) ? a.scopes.filter((s) => SCOPE_LABEL_FALLBACKS[s]) : [];
  if (arr.includes('all')) return ['all'];
  if (arr.length) return [...new Set(arr)];
  const single = a?.scope || 'all';
  return single === 'all' ? ['all'] : [single];
}

/** Stable key used to group announcements that target the same set of pages. */
function scopeGroupKey(a) {
  return effectiveScopes(a).slice().sort().join('|');
}

/** Human label for one or many scopes. */
function scopesLabel(t, a) {
  const arr = effectiveScopes(a);
  if (arr.includes('all')) return scopeLabel(t, 'all');
  return arr.map((s) => scopeLabel(t, s)).join(', ');
}

function blankAnnouncement(type = 'promotion') {
  const tp = ANNOUNCEMENT_TYPES.find((x) => x.id === type) ?? ANNOUNCEMENT_TYPES[0];
  return {
    type, text: '', icon_enabled: true, icon: tp.icon,
    bg_color: tp.bg, text_color: tp.text, font_size: 14, border_enabled: false,
    bg_style: '', bg_style_colors: '',
    cta_text: '', cta_href: '', promo_code: '',
    cta_display_mode: type === 'social' ? 'static' : 'swap',
    cta_swap_seconds: 4,
    social_whatsapp: '', social_facebook: '', social_instagram: '', social_tiktok: '',
    social_platforms: ['whatsapp'],
    social_btn_color: '',
    social_show_logo: false, social_logo_url: '',
    social_show_name: false, social_business_name: '',
    social_show_phone: false,
    marquee_messages: type === 'marquee' ? [''] : [],
    marquee_speed: 60,
    marquee_direction: 'left',
    marquee_pause_on_hover: true,
    marquee_separator: '•',
    marquee_scroll_mode: 'together',
    position: 'top', behavior: 'sticky', scope: 'all', scopes: ['all'],
    carousel_enabled: false, rotation_seconds: 5, dismissible: true,
    start_at: null, end_at: null, priority: 0, is_active: true,
    translations: {
      en: { text: '', cta_text: '', marquee_messages: type === 'marquee' ? [''] : [] },
      fr: { text: '', cta_text: '', marquee_messages: type === 'marquee' ? [''] : [] },
      ar: { text: '', cta_text: '', marquee_messages: type === 'marquee' ? [''] : [] },
      dr: { text: '', cta_text: '', marquee_messages: type === 'marquee' ? [''] : [] },
    },
  };
}

const ANNOUNCEMENT_LOCALES = ['en', 'fr', 'ar', 'dr'];

/**
 * Hydrates an announcement row coming from the DB so the editor always sees a
 * fully-populated `translations` object. Legacy rows (with no `translations`
 * column or empty entries) get their base `text` / `cta_text` /
 * `marquee_messages` mirrored into every locale slot — that way the admin
 * doesn't lose data and just edits per-locale overrides as needed.
 */
function normalizeAnnouncementForEdit(a) {
  const baseText = typeof a?.text === 'string' ? a.text : '';
  const baseCta = typeof a?.cta_text === 'string' ? a.cta_text : '';
  const baseMarquee = Array.isArray(a?.marquee_messages) ? a.marquee_messages : [];
  const tr = (a?.translations && typeof a.translations === 'object') ? a.translations : {};

  const translations = {};
  for (const loc of ANNOUNCEMENT_LOCALES) {
    const cur = tr[loc] && typeof tr[loc] === 'object' ? tr[loc] : {};
    translations[loc] = {
      text: typeof cur.text === 'string' ? cur.text : baseText,
      cta_text: typeof cur.cta_text === 'string' ? cur.cta_text : baseCta,
      marquee_messages: Array.isArray(cur.marquee_messages) && cur.marquee_messages.length > 0
        ? [...cur.marquee_messages]
        : [...baseMarquee],
    };
  }
  return { ...a, translations, scopes: effectiveScopes(a) };
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
        className={`w-full flex items-center justify-between gap-2 rounded-[5px] border bg-white px-3 py-2 text-sm outline-none transition-all cursor-pointer ${
          open
            ? 'border-blue-400'
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

function AnnouncementRow({ value, t, isFirst, isLast, onMove, onDelete, onToggle, onEdit, toggling }) {
  const typeInfo = ANNOUNCEMENT_TYPES.find((x) => x.id === value.type) ?? ANNOUNCEMENT_TYPES[0];
  const preset = resolveAnnouncementStyle(value.type, value.bg_style, value.bg_style_colors);
  return (
    <div
      className={`group w-full min-w-0 max-w-full overflow-hidden rounded-md border transition-all ${
        value.is_active
          ? 'border-zinc-200 bg-white hover:border-zinc-300'
          : 'border-zinc-100 bg-zinc-50/50'
      }`}
    >
      {/* Live preview bar */}
      <div
        className={`w-full min-w-0 max-w-full rounded-t-md overflow-hidden text-xs sm:text-sm font-medium break-words ${
          value.is_active ? '' : 'opacity-50 grayscale'
        }`}
        style={{
          background: preset?.css ?? undefined,
          backgroundColor: preset ? undefined : (value.bg_color ?? typeInfo.bg),
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
        ) : value.type === 'social' ? (
            <div className="px-4 py-5 flex flex-wrap items-center gap-2 min-h-[68px]">
              {/* Left: info */}
              <div className="flex items-center gap-2 shrink-0 min-w-0">
                {value.social_show_logo && value.social_logo_url && (
                  <img src={value.social_logo_url} alt="" className="h-6 w-6 rounded-full object-cover shrink-0" />
                )}
                {((value.social_show_name && value.social_business_name) || (value.social_show_phone && (value.social_whatsapp || value.social_facebook || ''))) && (
                  <span className="flex flex-col leading-tight">
                    {value.social_show_name && value.social_business_name && <span className="text-[10px] font-bold">{value.social_business_name}</span>}
                    {value.social_show_phone && (value.social_whatsapp || value.social_facebook || '') && <span className="text-[9px] opacity-70">{value.social_whatsapp || value.social_facebook || ''}</span>}
                  </span>
                )}
              </div>
              {/* Center: text */}
              <div className="flex-1 min-w-0 text-center break-words">
                {value.text || <span className="opacity-60 italic">{t.preview_placeholder ?? 'Preview…'}</span>}
              </div>
              {/* Right: buttons */}
              <div className="flex flex-wrap items-center gap-1.5 shrink-0 justify-end">
                {(value.social_platforms ?? []).filter((pid) => value[`social_${pid}`]).map((pid) => {
                  const p = SOCIAL_PLATFORMS.find((x) => x.id === pid);
                  if (!p) return null;
                  return (
                    <span key={pid} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold tracking-wide"
                      style={{ backgroundColor: value.social_btn_color || 'rgba(255,255,255,0.2)', color: '#fff' }}>
                      <BrandIcon name={pid} className="h-4 w-4" />
                      {p.label}
                    </span>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="px-4 py-2.5 text-center break-words">
              <span className="inline-flex items-center gap-1.5 flex-wrap justify-center max-w-full">
                {value.icon_enabled && value.icon && (
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
              </span>
            </div>
          )}
      </div>

      {/* Meta + actions */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 sm:px-4 py-2.5">
        <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize"
          style={{ backgroundColor: `${typeInfo.bg}1a`, color: typeInfo.bg }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: typeInfo.bg }} />
          {t[`type_${value.type}`] ?? typeInfo.label}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium bg-zinc-100 text-zinc-600">
          <Megaphone className="h-3 w-3 opacity-60" />
          {scopesLabel(t, value)}
        </span>
        <span className="text-[11px] text-zinc-400 capitalize hidden sm:inline">
          {value.position ?? 'top'}
        </span>
        <div className="flex items-center gap-0.5 ms-auto">
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
            <Toggle checked={value.is_active} onChange={onToggle} loading={toggling} disabled={toggling} />
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
    const el = document.querySelector('[data-scroll-main]');
    if (el) el.style.overflow = 'hidden';
    return () => { const el = document.querySelector('[data-scroll-main]'); if (el) el.style.overflow = ''; };
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

/**
 * Multi-page scope picker. `value` is the effective scopes array (e.g. ['all']
 * or ['cart','checkout']). Selecting "All pages" clears specific pages, and
 * selecting any specific page turns off "All pages".
 */
function ScopeMultiSelect({ value, onChange, t }) {
  const selected = Array.isArray(value) && value.length ? value : ['all'];
  const isAll = selected.includes('all');

  const chipCls = (active) =>
    `inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all active:scale-95 ${
      active
        ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
        : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50'
    }`;

  const toggle = (id) => {
    if (id === 'all') { onChange(['all']); return; }
    let next = isAll ? [] : selected.filter((s) => s !== 'all');
    next = next.includes(id) ? next.filter((s) => s !== id) : [...next, id];
    onChange(next.length ? next : ['all']);
  };

  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => toggle('all')} className={chipCls(isAll)}>
        {isAll && <Check className="h-3.5 w-3.5" />}
        {scopeLabel(t, 'all')}
      </button>
      {SCOPE_PAGE_IDS.map((id) => {
        const active = !isAll && selected.includes(id);
        return (
          <button key={id} type="button" onClick={() => toggle(id)} className={chipCls(active)}>
            {active && <Check className="h-3.5 w-3.5" />}
            {scopeLabel(t, id)}
          </button>
        );
      })}
    </div>
  );
}

function AnnouncementDrawer({ value, t, onUpdate, onClose, onSaveRow, saving }) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [activeLang, setActiveLang] = useState('en');

  const ANN_LANGS = ['en', 'fr', 'ar', 'dr'];
  const ANN_LANG_LABELS = { en: 'English', fr: 'Français', ar: 'العربية', dr: 'الدارجة' };
  const ANN_RTL_LANGS = new Set(['ar', 'dr']);

  /** Read a translatable field for the active locale, falling back to the base column. */
  const readTr = (field) => {
    const tr = value.translations?.[activeLang];
    if (Array.isArray(tr?.[field])) return tr[field];
    if (typeof tr?.[field] === 'string') return tr[field];
    return Array.isArray(value[field]) ? value[field] : (value[field] ?? '');
  };

  /** Update a translatable field for the active locale (and mirror to base when active locale is the source-of-truth). */
  const setTr = (field, val) => {
    const prev = value.translations ?? {};
    const cur = prev[activeLang] ?? { text: '', cta_text: '', marquee_messages: [] };
    const nextTranslations = { ...prev, [activeLang]: { ...cur, [field]: val } };
    onUpdate('translations', nextTranslations);
    // Keep the legacy base column in sync from English so any non-localised
    // consumer (or older clients) still has a meaningful value to display.
    if (activeLang === 'en') onUpdate(field, val);
  };

  const previewTr = value.translations?.[activeLang] ?? {};
  const previewText = (typeof previewTr.text === 'string' && previewTr.text) ? previewTr.text : value.text;
  const previewCta = (typeof previewTr.cta_text === 'string' && previewTr.cta_text) ? previewTr.cta_text : value.cta_text;
  const previewMarquee = (Array.isArray(previewTr.marquee_messages) && previewTr.marquee_messages.some((m) => m && m.trim().length))
    ? previewTr.marquee_messages
    : value.marquee_messages;
  const previewValue = { ...value, text: previewText, cta_text: previewCta, marquee_messages: previewMarquee };

  useEffect(() => {
    setMounted(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    return () => { const el = document.querySelector('[data-scroll-main]'); if (el) el.style.overflow = ''; };
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const el = document.querySelector('[data-scroll-main]');
    if (el) el.style.overflow = 'hidden';
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

  const inputCls = "w-full rounded-[5px] border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:border-blue-400 transition-all";

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
          left-0 right-0 bottom-0 rounded-t-xl max-h-[88dvh]
          sm:left-auto sm:right-0 sm:top-0 sm:bottom-0 sm:rounded-none sm:w-[min(560px,100vw)] sm:max-h-none sm:h-full
          rtl:sm:right-auto rtl:sm:left-0
          transition-all duration-300 ease-out
          ${visible
            ? 'translate-y-0 opacity-100 sm:translate-y-0 sm:translate-x-0'
            : 'translate-y-[110%] opacity-0 sm:translate-y-0 sm:translate-x-full rtl:sm:-translate-x-full'}`}
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
          {(() => {
            const drawerPreset = resolveAnnouncementStyle(value.type, value.bg_style, value.bg_style_colors);
            return (
          <div
            className="rounded-xl overflow-hidden text-sm font-medium"
            style={{
              background: drawerPreset?.css ?? undefined,
              backgroundColor: drawerPreset ? undefined : (value.bg_color ?? '#111'),
              color: value.text_color || '#fff',
              border: value.border_enabled ? '1px solid rgba(0,0,0,0.15)' : 'none',
              fontSize: value.font_size ? `${value.font_size}px` : undefined,
            }}
          >
            {value.type === 'marquee' ? (
              <div className="py-3" dir={ANN_RTL_LANGS.has(activeLang) ? 'rtl' : 'ltr'}>
                {((previewMarquee ?? []).filter((m) => m && m.trim().length)).length > 0
                  ? <MarqueePreview a={previewValue} />
                  : <p className="text-center opacity-50 py-0.5">{t.preview_placeholder ?? 'Your message preview…'}</p>
                }
              </div>
            ) : value.type === 'social' ? (
              <div className="px-4 py-3 flex items-center gap-3" dir={ANN_RTL_LANGS.has(activeLang) ? 'rtl' : 'ltr'}>
                {/* Left: info */}
                <div className="flex items-center gap-2 shrink-0">
                  {value.social_show_logo && value.social_logo_url && (
                    <img src={value.social_logo_url} alt="" className="h-7 w-7 rounded-full object-cover shrink-0" />
                  )}
                  {((value.social_show_name && value.social_business_name) || (value.social_show_phone && (value.social_whatsapp || value.social_facebook || ''))) && (
                    <span className="flex flex-col leading-tight">
                      {value.social_show_name && value.social_business_name && <span className="text-[11px] font-bold">{value.social_business_name}</span>}
                      {value.social_show_phone && (value.social_whatsapp || value.social_facebook || '') && <span className="text-[10px] opacity-70">{value.social_whatsapp || value.social_facebook || ''}</span>}
                    </span>
                  )}
                </div>
                {/* Center: text */}
                <div className="flex-1 text-center">
                  {previewText || <span className="opacity-50">{t.preview_placeholder ?? 'Your message preview…'}</span>}
                </div>
                {/* Right: buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  {(value.social_platforms ?? []).filter((pid) => value[`social_${pid}`]).map((pid) => {
                    const p = SOCIAL_PLATFORMS.find((x) => x.id === pid);
                    if (!p) return null;
                    return (
                      <span key={pid} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold tracking-wide"
                        style={{ backgroundColor: value.social_btn_color || 'rgba(255,255,255,0.2)', color: '#fff' }}>
                        <BrandIcon name={pid} className="h-4 w-4" />
                        {p.label}
                      </span>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="px-4 py-3 text-center" dir={ANN_RTL_LANGS.has(activeLang) ? 'rtl' : 'ltr'}>
                <span className="inline-flex items-center gap-2 flex-wrap justify-center">
                  {value.icon_enabled && value.icon && (
                    <PreviewAnnouncementIcon icon={value.icon} className="h-4 w-4 shrink-0" />
                  )}
                  {(() => {
                    const textNode = <span>{previewText || <span className="opacity-50">{t.preview_placeholder ?? 'Your message preview…'}</span>}</span>;
                    const ctaNode = previewCta ? (
                      <span className="px-4 py-2 rounded-full bg-white text-black text-xs font-bold tracking-wide shadow-sm">{previewCta}</span>
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
                </span>
              </div>
            )}
          </div>
            );
          })()}

          {/* Language tab switcher (translatable fields below) */}
          <div className="flex gap-1 p-1 bg-zinc-100 rounded-[5px]">
            {ANN_LANGS.map((lang) => {
              const tr = value.translations?.[lang];
              const hasContent =
                (typeof tr?.text === 'string' && tr.text.trim()) ||
                (typeof tr?.cta_text === 'string' && tr.cta_text.trim()) ||
                (Array.isArray(tr?.marquee_messages) && tr.marquee_messages.some((m) => m && m.trim()));
              return (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setActiveLang(lang)}
                  className={`relative flex-1 py-1.5 text-xs font-semibold rounded-[5px] transition-all ${
                    activeLang === lang
                      ? 'bg-white text-zinc-900'
                      : 'text-zinc-500 hover:text-zinc-700'
                  }`}
                >
                  {ANN_LANG_LABELS[lang]}
                  {hasContent && (
                    <span className="absolute top-1 end-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Message (single-line types) */}
          {value.type !== 'marquee' && (
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1.5">{t.text ?? 'Message'}</label>
              <input
                className={inputCls}
                placeholder={t.text_placeholder ?? 'e.g. Free shipping on orders over $99'}
                value={readTr('text') ?? ''}
                onChange={(e) => setTr('text', e.target.value)}
                dir={ANN_RTL_LANGS.has(activeLang) ? 'rtl' : 'ltr'}
              />
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
                    onClick={() => setTr('marquee_messages', [...(readTr('marquee_messages') ?? []), ''])}
                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                  >
                    <Plus className="h-3.5 w-3.5" /> {t.marquee_add_message ?? 'Add message'}
                  </button>
                </div>
                <div className="space-y-2">
                  {(readTr('marquee_messages') ?? []).map((msg, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        className={inputCls}
                        placeholder={t.marquee_message_placeholder ?? `Message ${i + 1}`}
                        value={msg}
                        dir={ANN_RTL_LANGS.has(activeLang) ? 'rtl' : 'ltr'}
                        onChange={(e) => {
                          const next = [...(readTr('marquee_messages') ?? [])];
                          next[i] = e.target.value;
                          setTr('marquee_messages', next);
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const next = (readTr('marquee_messages') ?? []).filter((_, j) => j !== i);
                          setTr('marquee_messages', next);
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

              {/* Button color */}
              <div className="rounded-xl border border-zinc-100 p-3 space-y-2">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">{t.social_btn_color_label ?? 'Button color'}</p>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={value.social_btn_color || '#25D366'}
                    onChange={(e) => onUpdate('social_btn_color', e.target.value)}
                    className="h-9 w-14 rounded-[5px] cursor-pointer border border-zinc-200 p-0.5"
                  />
                  <span className="text-xs text-zinc-500 font-mono">{value.social_btn_color || '— default'}</span>
                  {value.social_btn_color && (
                    <button type="button" onClick={() => onUpdate('social_btn_color', '')} className="text-xs text-zinc-400 hover:text-zinc-600 underline">
                      {t.reset ?? 'Reset'}
                    </button>
                  )}
                </div>
              </div>

              {/* Info panel: logo / name / phone */}
              <div className="rounded-xl border border-zinc-100 p-3 space-y-3">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">{t.social_info_label ?? 'Contact info panel'}</p>

                {/* Logo */}
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={!!value.social_show_logo} onChange={(e) => onUpdate('social_show_logo', e.target.checked)} className="h-4 w-4 rounded border-zinc-300 accent-blue-600" />
                  <span className="text-sm font-medium text-zinc-800">{t.social_show_logo ?? 'Show logo'}</span>
                </label>
                {value.social_show_logo && (
                  <input className={inputCls} placeholder="https://your-store.com/logo.png" value={value.social_logo_url ?? ''} onChange={(e) => onUpdate('social_logo_url', e.target.value)} />
                )}

                {/* Business name */}
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={!!value.social_show_name} onChange={(e) => onUpdate('social_show_name', e.target.checked)} className="h-4 w-4 rounded border-zinc-300 accent-blue-600" />
                  <span className="text-sm font-medium text-zinc-800">{t.social_show_name ?? 'Show business name'}</span>
                </label>
                {value.social_show_name && (
                  <input className={inputCls} placeholder="My Store" value={value.social_business_name ?? ''} onChange={(e) => onUpdate('social_business_name', e.target.value)} />
                )}

                {/* Phone / handle */}
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={!!value.social_show_phone} onChange={(e) => onUpdate('social_show_phone', e.target.checked)} className="h-4 w-4 rounded border-zinc-300 accent-blue-600" />
                  <span className="text-sm font-medium text-zinc-800">{t.social_show_phone ?? 'Show phone number'}</span>
                </label>
              </div>
            </div>
          )}

          {value.type !== 'marquee' && value.type !== 'social' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1.5">{t.cta_text ?? 'Button text'}</label>
                  <input
                    className={inputCls}
                    placeholder={t.cta_text_placeholder ?? 'Shop now'}
                    value={readTr('cta_text') ?? ''}
                    onChange={(e) => setTr('cta_text', e.target.value)}
                    dir={ANN_RTL_LANGS.has(activeLang) ? 'rtl' : 'ltr'}
                  />
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

          {/* Pre-built styles */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                {t.prebuilt_styles ?? 'Pre-built styles & colors'}
              </p>
              {value.bg_style && (
                <button
                  type="button"
                  onClick={() => {
                    onUpdate('bg_style', '');
                    onUpdate('bg_style_colors', '');
                  }}
                  className="text-xs text-zinc-400 hover:text-zinc-600 underline"
                >
                  {t.reset ?? 'Reset'}
                </button>
              )}
            </div>
            <p className="text-[11px] text-zinc-400 mb-3">
              {t.prebuilt_styles_hint ?? 'Pick a design, then tune its gradient colors below.'}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(ANNOUNCEMENT_STYLE_PRESETS[value.type] ?? []).map((p) => {
                const selected = value.bg_style === p.id;
                // For the selected preset, reflect the live color override in the swatch preview.
                const shown = selected
                  ? (resolveAnnouncementStyle(value.type, p.id, value.bg_style_colors) ?? p)
                  : p;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      onUpdate('bg_style', p.id);
                      onUpdate('bg_style_colors', (p.colors ?? []).join(','));
                      onUpdate('bg_color', p.solid);
                      onUpdate('text_color', p.text);
                    }}
                    className={`group relative rounded-lg overflow-hidden border transition-all text-start focus:outline-none ${
                      selected
                        ? 'border-blue-500 ring-2 ring-blue-500/30'
                        : 'border-zinc-200 hover:border-zinc-300'
                    }`}
                  >
                    <div
                      className="h-12 w-full flex items-center justify-center"
                      style={{ background: shown.css, color: shown.text }}
                    >
                      <span className="text-[11px] font-bold tracking-wide">Aa</span>
                    </div>
                    <div className="px-2 py-1.5 bg-white">
                      <p className="text-[11px] font-medium text-zinc-800 truncate">{p.label}</p>
                    </div>
                    {selected && (
                      <span className="absolute top-1 end-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-white">
                        <Check className="h-2.5 w-2.5" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Per-stop color inputs — only when a preset is selected */}
            {value.bg_style && (() => {
              const activePreset = ANNOUNCEMENT_STYLE_PRESETS[value.type]?.find((p) => p.id === value.bg_style);
              const defaults = getPresetDefaultColors(value.bg_style) ?? activePreset?.colors ?? [];
              const parsed = String(value.bg_style_colors ?? '')
                .split(',')
                .map((c) => c.trim())
                .filter(Boolean);
              const colors = parsed.length >= 2 ? parsed : defaults;
              const setColorAt = (idx, hex) => {
                const next = [...colors];
                next[idx] = hex;
                onUpdate('bg_style_colors', next.join(','));
                if (idx === 0) onUpdate('bg_color', hex);
              };
              return (
                <div className="mt-4 rounded-lg border border-zinc-100 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                      {t.gradient_colors ?? 'Gradient colors'}
                    </p>
                    <button
                      type="button"
                      onClick={() => onUpdate('bg_style_colors', defaults.join(','))}
                      className="text-[11px] text-zinc-400 hover:text-zinc-600 underline"
                    >
                      {t.reset_colors ?? 'Reset colors'}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {colors.map((hex, i) => (
                      <label key={i} className="flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2 py-1.5">
                        <input
                          type="color"
                          value={hex || '#000000'}
                          onChange={(e) => setColorAt(i, e.target.value)}
                          className="h-6 w-8 cursor-pointer rounded-sm border-0 bg-transparent p-0"
                        />
                        <span className="text-[10px] font-mono text-zinc-600">{hex}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Style */}
          <div>
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">
              {value.bg_style
                ? (t.style_label_typography ?? 'Text & typography')
                : (t.style_label ?? 'Style')}
            </p>
            <div className={`grid gap-3 ${value.bg_style ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'}`}>
              {!value.bg_style && (
                <div>
                  <label className="block text-xs text-zinc-600 mb-1.5">{t.bg_color ?? 'Background'}</label>
                  <input type="color" value={value.bg_color || '#111111'} onChange={(e) => onUpdate('bg_color', e.target.value)} className="h-10 w-full rounded-[5px] border border-zinc-200 cursor-pointer" />
                </div>
              )}
              <div>
                <label className="block text-xs text-zinc-600 mb-1.5">{t.text_color ?? 'Text color'}</label>
                <input type="color" value={value.text_color || '#ffffff'} onChange={(e) => onUpdate('text_color', e.target.value)} className="h-10 w-full rounded-[5px] border border-zinc-200 cursor-pointer" />
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
              <div className="col-span-2">
                <label className="block text-xs text-zinc-600 mb-1.5">{t.scope ?? 'Scope'}</label>
                <ScopeMultiSelect
                  t={t}
                  value={effectiveScopes(value)}
                  onChange={(next) => {
                    onUpdate('scopes', next);
                    onUpdate('scope', next.includes('all') || next.length === 0 ? 'all' : next[0]);
                  }}
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
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-[5px] bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 transition-colors">
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
  const [deleting, setDeleting] = useState(false);
  const [togglingIdxs, setTogglingIdxs] = useState(new Set());
  const [editIdx, setEditIdx] = useState(null);
  const [draft, setDraft] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Per-scope rotation save indicator. Holds the scope id currently being saved
  // (or null when idle). The slider value itself lives on each item's row, so
  // we don't track it here — the UI reads `rotation_seconds` from the first
  // entry of each group, which is always in sync after a successful save.
  const [rotationSavingScope, setRotationSavingScope] = useState(null);
  // Use a ref (not state) so the close handler always reads the latest value.
  // The drawer closes asynchronously via setTimeout, so a stale state closure
  // would otherwise filter out an item that was just successfully saved.
  const discardOnCloseRef = useRef(false);

  useEffect(() => {
    fetch('/api/v1/admin/announcements')
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setItems(json.data);
        }
      })
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
    setDraft(normalizeAnnouncementForEdit(items[idx]));
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

    // Client-side validation (server also re-validates)
    if (draft.start_at && draft.end_at) {
      const s = new Date(draft.start_at).getTime();
      const e = new Date(draft.end_at).getTime();
      if (Number.isFinite(s) && Number.isFinite(e) && e <= s) {
        toast.error(t.validation_end_before_start ?? 'End date must be after start date');
        return;
      }
    }
    if (draft.cta_href && !/^(?:https?:\/\/|\/|#|mailto:|tel:)/i.test(String(draft.cta_href).trim())) {
      toast.error(t.validation_invalid_url ?? 'Button link must start with http(s)://, /, # or mailto:');
      return;
    }

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

  const toggleActive = async (idx, val) => {
    const prev = items;
    const next = items.map((it, i) => (i === idx ? { ...it, is_active: val } : it));
    setItems(next);
    setTogglingIdxs((s) => { const n = new Set(s); n.add(idx); return n; });
    try {
      await persist(next);
      toast.success(val ? (t.enabled ?? 'Announcement enabled') : (t.disabled ?? 'Announcement disabled'));
    } catch (err) {
      setItems(prev);
      toast.error(err.message ?? 'Failed to update');
    } finally {
      setTogglingIdxs((s) => { const n = new Set(s); n.delete(idx); return n; });
    }
  };

  const changeRotationForScope = async (scopeKey, val) => {
    const secs = Math.max(2, Math.min(60, val));
    const prev = items;
    const next = items.map((it) =>
      scopeGroupKey(it) === scopeKey ? { ...it, rotation_seconds: secs } : it,
    );
    setItems(next);
    setRotationSavingScope(scopeKey);
    try {
      await persist(next);
    } catch (err) {
      setItems(prev);
      toast.error(err.message ?? 'Failed to update');
    } finally {
      setRotationSavingScope(null);
    }
  };

  /**
   * Move an item up/down within its scope group.
   * `gIdx` is the position within the group, not the global items index.
   */
  const moveWithinScope = async (scopeKey, gIdx, dir) => {
    const groupGlobalIdxs = items
      .map((it, i) => ({ it, i }))
      .filter(({ it }) => scopeGroupKey(it) === scopeKey)
      .map(({ i }) => i);
    const target = gIdx + dir;
    if (target < 0 || target >= groupGlobalIdxs.length) return;
    const a = groupGlobalIdxs[gIdx];
    const b = groupGlobalIdxs[target];
    const next = [...items];
    [next[a], next[b]] = [next[b], next[a]];
    next.forEach((it, i) => (it.priority = i));
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
    const prev = items;
    const next = items.filter((_, i) => i !== idx);
    setDeleting(true);
    try {
      await persist(next);
      setItems(next);
      setConfirmDelete(null);
      toast.success(t.deleted ?? 'Announcement deleted');
    } catch (err) {
      setItems(prev);
      toast.error(err.message ?? 'Failed to delete');
    } finally {
      setDeleting(false);
    }
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

      <div className="flex items-center justify-end mb-4 gap-4 flex-wrap">
        <button
          type="button"
          onClick={startAdd}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          {t.add ?? 'Add Announcement'}
        </button>
      </div>

      <div className="flex flex-col gap-4 mb-5">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 rounded-2xl border border-dashed border-zinc-200 text-zinc-400">
            <Megaphone className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm font-medium text-zinc-500">{t.no_items ?? 'No announcements yet.'}</p>
            <p className="text-xs text-zinc-400 mt-1">{t.no_items_hint ?? 'Click “Add Announcement” to create your first banner.'}</p>
          </div>
        ) : (
          (() => {
            // Group items by scope while preserving original priority order.
            const groups = [];
            const byScope = new Map();
            items.forEach((a, idx) => {
              const key = scopeGroupKey(a);
              if (!byScope.has(key)) {
                const g = { key, sample: a, entries: [] };
                byScope.set(key, g);
                groups.push(g);
              }
              byScope.get(key).entries.push({ a, idx });
            });

            return groups.map((g) => {
              const groupRotation = g.entries[0]?.a.rotation_seconds ?? 5;
              const showRotation = g.entries.length > 1;
              return (
                <section
                  key={g.key}
                  className="min-w-0 max-w-full rounded-2xl border border-zinc-200 bg-white/60 overflow-hidden"
                >
                  {/* Group header */}
                  <header className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-zinc-100 bg-zinc-50/70 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="inline-flex items-center justify-center h-6 w-6 rounded-md bg-blue-100 text-blue-600">
                        <Megaphone className="h-3.5 w-3.5" />
                      </span>
                      <span className="text-sm font-semibold text-zinc-800 truncate">
                        {scopesLabel(t, g.sample)}
                      </span>
                      <span className="text-[11px] text-zinc-400">
                        · {g.entries.length} {g.entries.length === 1 ? (t.item_one ?? 'item') : (t.item_many ?? 'items')}
                      </span>
                    </div>
                    {showRotation && (
                      <div className="flex items-center gap-2 min-w-0 px-3 py-1.5 rounded-lg bg-white border border-zinc-200">
                        <Clock className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                        <span className="text-xs text-zinc-600 shrink-0 hidden sm:inline">
                          {t.rotation_speed ?? 'Rotation'}
                        </span>
                        <input
                          type="range"
                          min={2}
                          max={60}
                          defaultValue={groupRotation}
                          onMouseUp={(e) => changeRotationForScope(g.key, Number(e.target.value))}
                          onTouchEnd={(e) => changeRotationForScope(g.key, Number(e.target.value))}
                          onChange={(e) => {
                            // Local visual feedback only — persist on release.
                            e.target.nextElementSibling.textContent = `${e.target.value}s`;
                          }}
                          className="w-32 accent-blue-600"
                          aria-label={t.rotation_speed ?? 'Rotation speed'}
                        />
                        <span className="text-xs font-semibold text-zinc-700 w-9 text-right tabular-nums">
                          {rotationSavingScope === g.key
                            ? <Loader2 className="h-3 w-3 animate-spin inline" />
                            : `${groupRotation}s`}
                        </span>
                      </div>
                    )}
                  </header>

                  {/* Group items */}
                  <div className="flex flex-col gap-2 p-3">
                    {g.entries.map(({ a, idx }, gIdx) => (
                      <AnnouncementRow
                        key={idx}
                        value={a}
                        t={t}
                        isFirst={gIdx === 0}
                        isLast={gIdx === g.entries.length - 1}
                        onMove={(dir) => moveWithinScope(g.key, gIdx, dir)}
                        onToggle={(val) => toggleActive(idx, val)}
                        toggling={togglingIdxs.has(idx)}
                        onEdit={() => openEdit(idx)}
                        onDelete={() => setConfirmDelete(idx)}
                      />
                    ))}
                  </div>
                </section>
              );
            });
          })()
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
        isLoading={deleting}
        onConfirm={() => remove(confirmDelete)}
        onCancel={() => { if (!deleting) setConfirmDelete(null); }}
      />
    </>
  );
}

// ── Product Sections (global defaults) ──────────────────────────────────────
function ProductSectionsSection() {
  const dict = useDictionary();
  const t = dict?.admin?.settings?.product_sections ?? {};
  const [sections, setSections] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/v1/admin/product-sections");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load");
        if (!cancelled) setSections(Array.isArray(json.data) ? json.data : []);
      } catch (err) {
        if (!cancelled) {
          toast.error(err?.message ?? "Failed to load");
          setSections([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const saveToServer = async (data) => {
    const res = await fetch("/api/v1/admin/product-sections", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sections: data }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to save");
    setSections(json.data);
  };

  const save = async () => {
    setSaving(true);
    try {
      await saveToServer(sections);
      toast.success(t.saved ?? "Product sections saved");
    } catch (err) {
      toast.error(err?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (next) => {
    await saveToServer(next);
    toast.success(t.saved ?? "Product sections saved");
  };

  return (
    <>
      <SectionHeader
        title={t.title ?? "Product Page Sections"}
        description={t.desc ?? "Build the default layout used by every product page. Per-product overrides live on the product itself."}
      />
      {loading || sections === null ? (
        <p className="text-sm text-zinc-500 py-8 text-center">Loading...</p>
      ) : (
        <SectionsBuilder
          value={sections}
          onChange={setSections}
          onDelete={handleDelete}
          onSave={handleDelete}
          emptyText={t.empty ?? "No sections yet."}
          context="global"
        />
      )}
      <div className="pt-4 mt-2 border-t border-zinc-100 flex justify-end">
        <button
          onClick={save}
          disabled={saving || loading}
          className="flex items-center gap-2 rounded-[5px] bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? (dict?.admin?.settings?.saving ?? "Saving…") : (dict?.admin?.settings?.save ?? "Save changes")}
        </button>
      </div>
    </>
  );
}