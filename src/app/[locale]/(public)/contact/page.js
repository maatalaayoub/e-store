"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useDictionary, useLocale } from "@/components/providers/LocaleProvider";
import { Mail, Phone, MapPin, MessageCircle, Send, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";

function useStoreLogo() {
  const [logo, setLogo] = useState({ url: null });
  useEffect(() => {
    fetch("/api/v1/display-settings")
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data) {
          setLogo({ url: json.data.store_logo ? json.data.store_logo : null });
        }
      })
      .catch(() => {});
  }, []);
  return logo;
}

function ContactLogo() {
  const { locale } = useParams();
  const { url } = useStoreLogo();
  if (!url) return <div className="h-5 w-32" />;
  return (
    <Link href={`/${locale}`} className="flex items-center">
      <Image
        src={url}
        alt="LaCérémonie"
        width={160}
        height={40}
        className="h-5 w-auto object-contain"
        priority
      />
    </Link>
  );
}

export default function ContactPage() {
  const { locale } = useParams();
  const { dir } = useLocale();
  const dict = useDictionary();
  const t = dict?.contact ?? {};
  const tNav = dict?.nav ?? {};
  const isRtl = dir === "rtl";

  const [settings, setSettings] = useState({
    contact_email: "",
    contact_phone: "",
    contact_whatsapp: "",
    contact_address: "",
  });
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetch("/api/v1/display-settings")
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data) {
          setSettings({
            contact_email: json.data.contact_email ?? "",
            contact_phone: json.data.contact_phone ?? "",
            contact_whatsapp: json.data.contact_whatsapp ?? "",
            contact_address: json.data.contact_address ?? "",
          });
        }
      })
      .catch(() => {});
  }, []);

  const handleChange = (key) => (e) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      const res = await fetch("/api/v1/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Failed");
      toast.success(t.success ?? "Message sent");
      setForm({ name: "", email: "", phone: "", subject: "", message: "" });
    } catch (err) {
      toast.error(err?.message ?? t.error ?? "Failed");
    } finally {
      setSending(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-blue-600 placeholder:text-zinc-400";

  return (
    <div className="min-h-screen flex flex-col bg-white text-zinc-900">
      {/* Simple header */}
      <header className="border-b border-zinc-100">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link
            href={`/${locale}`}
            className="flex items-center gap-2 text-sm font-medium text-zinc-600 hover:text-zinc-900"
          >
            <ArrowLeft className={`h-4 w-4 ${isRtl ? "rotate-180" : ""}`} />
            {tNav.back ?? "Back"}
          </Link>
          <ContactLogo />
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="mb-12 text-center">
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
              {t.title ?? "Contact Us"}
            </h1>
            <p className="mt-3 text-base text-zinc-500 max-w-xl mx-auto">
              {t.subtitle ?? "Have a question? We'd love to hear from you."}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
            {/* Contact info */}
            <div className="space-y-8">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">
                  {t.info_title ?? "Get in touch"}
                </h2>
                <p className="mt-2 text-sm text-zinc-500">
                  {t.info_desc ??
                    "Reach out directly or send us a message and we'll get back to you as soon as possible."}
                </p>
              </div>

              <div className="space-y-4">
                {settings.contact_email && (
                  <a
                    href={`mailto:${settings.contact_email}`}
                    className="flex items-start gap-4 rounded-xl border border-zinc-100 p-4 hover:border-blue-200 hover:bg-blue-50/30 transition-colors"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                      <Mail className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-900">{t.email ?? "Email"}</p>
                      <p className="text-sm text-zinc-600 mt-0.5">{settings.contact_email}</p>
                    </div>
                  </a>
                )}

                {settings.contact_phone && (
                  <a
                    href={`tel:${settings.contact_phone}`}
                    className="flex items-start gap-4 rounded-xl border border-zinc-100 p-4 hover:border-blue-200 hover:bg-blue-50/30 transition-colors"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                      <Phone className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-900">{t.phone ?? "Phone"}</p>
                      <p className="text-sm text-zinc-600 mt-0.5">{settings.contact_phone}</p>
                    </div>
                  </a>
                )}

                {settings.contact_whatsapp && (
                  <a
                    href={`https://wa.me/${settings.contact_whatsapp.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-4 rounded-xl border border-zinc-100 p-4 hover:border-green-200 hover:bg-green-50/30 transition-colors"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-600">
                      <MessageCircle className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-900">
                        {t.whatsapp ?? "WhatsApp"}
                      </p>
                      <p className="text-sm text-zinc-600 mt-0.5">{settings.contact_whatsapp}</p>
                    </div>
                  </a>
                )}

                {settings.contact_address && (
                  <div className="flex items-start gap-4 rounded-xl border border-zinc-100 p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-600">
                      <MapPin className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-900">
                        {t.address ?? "Address"}
                      </p>
                      <p className="text-sm text-zinc-600 mt-0.5 whitespace-pre-line">
                        {settings.contact_address}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Contact form */}
            <div className="rounded-2xl border border-zinc-100 bg-zinc-50/50 p-6 sm:p-8">
              <h2 className="text-lg font-semibold text-zinc-900 mb-6">
                {t.form_title ?? "Send a message"}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                    {t.name_label ?? "Your name"} *
                  </label>
                  <input
                    className={inputClass}
                    value={form.name}
                    onChange={handleChange("name")}
                    placeholder={t.name_placeholder ?? "John Doe"}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                    {t.email_label ?? "Email address"} *
                  </label>
                  <input
                    type="email"
                    className={inputClass}
                    value={form.email}
                    onChange={handleChange("email")}
                    placeholder={t.email_placeholder ?? "john@example.com"}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                    {t.phone_label ?? "Phone number"}
                  </label>
                  <input
                    type="tel"
                    className={inputClass}
                    value={form.phone}
                    onChange={handleChange("phone")}
                    placeholder={t.phone_placeholder ?? "+212 600 000 000"}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                    {t.subject_label ?? "Subject"}
                  </label>
                  <input
                    className={inputClass}
                    value={form.subject}
                    onChange={handleChange("subject")}
                    placeholder={t.subject_placeholder ?? "How can we help?"}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                    {t.message_label ?? "Message"} *
                  </label>
                  <textarea
                    rows={5}
                    className={`${inputClass} resize-none`}
                    value={form.message}
                    onChange={handleChange("message")}
                    placeholder={t.message_placeholder ?? "Tell us more about your request..."}
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={sending}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {sending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t.sending ?? "Sending…"}
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      {t.submit ?? "Send message"}
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </main>

      {/* Simple footer */}
      <footer className="border-t border-zinc-100 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 text-center text-xs text-zinc-400">
          © {new Date().getFullYear()} {dict?.common?.store_name ?? "My store"}
        </div>
      </footer>
    </div>
  );
}
