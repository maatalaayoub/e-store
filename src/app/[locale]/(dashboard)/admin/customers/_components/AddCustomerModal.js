"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { useDictionary } from "@/components/providers/LocaleProvider";

/**
 * Modal for admins to create a new customer account.
 * Calls POST /api/v1/admin/customers which uses the Supabase admin API to
 * provision an email-confirmed auth user + fill their public profile row.
 */
export default function AddCustomerModal({ isOpen, onClose, onCreated }) {
  const dict = useDictionary();
  const t = dict?.admin?.customers ?? {};
  const tA = t.add_modal ?? {};

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [snapshot, setSnapshot] = useState(false);

  useEffect(() => {
    if (isOpen) setSnapshot(true);
    else {
      const id = setTimeout(() => setSnapshot(false), 250);
      return () => clearTimeout(id);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    // Reset form each time the modal opens.
    setEmail("");
    setPassword("");
    setFullName("");
    setPhone("");
    setAddress("");
    setCity("");
    setCountry("");
    setShowPass(false);
    setError(null);
    setSubmitting(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape" && !submitting) onClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, submitting, onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError(tA.err_email ?? "Please enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setError(tA.err_password ?? "Password must be at least 6 characters.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/admin/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          full_name: fullName.trim(),
          phone_number: phone.trim(),
          address: address.trim(),
          city: city.trim(),
          country: country.trim(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        setError(json?.error ?? tA.err_generic ?? "Failed to create customer.");
        return;
      }
      toast.success(tA.success ?? "Customer created");
      onCreated?.(json.data?.id);
      onClose?.();
    } catch {
      setError(tA.err_generic ?? "Failed to create customer.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!snapshot || typeof document === "undefined") return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[10100] flex items-center justify-center bg-black/50 px-4 transition-opacity duration-200 ${
        isOpen ? "opacity-100" : "opacity-0"
      }`}
      onClick={submitting ? undefined : onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className={`bg-white rounded-[3px] shadow-2xl w-full max-w-lg overflow-hidden transition-transform duration-200 ${
          isOpen ? "translate-y-0" : "translate-y-2"
        }`}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-zinc-100">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[3px] bg-blue-50 text-blue-600">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-900">
                {tA.title ?? "Add customer"}
              </h2>
              <p className="text-sm text-zinc-500">
                {tA.subtitle ??
                  "Create an account on behalf of a customer. They can log in immediately."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex h-9 w-9 items-center justify-center rounded-[3px] text-zinc-500 hover:bg-zinc-100"
            aria-label={dict?.common?.close ?? "Close"}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {error && (
            <p className="rounded-[3px] border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label={tA.full_name ?? "Full name"}>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-[3px] border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-600"
                autoComplete="off"
              />
            </Field>
            <Field label={tA.email ?? "Email"} required>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-[3px] border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-600"
                autoComplete="off"
              />
            </Field>
            <Field label={tA.password ?? "Password"} required className="sm:col-span-2">
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full rounded-[3px] border border-zinc-200 px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-1 focus:ring-blue-600"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute inset-y-0 right-2 flex items-center text-zinc-400 hover:text-zinc-600"
                  aria-label="Toggle password visibility"
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                {tA.password_hint ?? "At least 6 characters."}
              </p>
            </Field>
            <Field label={tA.phone ?? "Phone"}>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-[3px] border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </Field>
            <Field label={tA.city ?? "City"}>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full rounded-[3px] border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </Field>
            <Field label={tA.address ?? "Address"} className="sm:col-span-2">
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full rounded-[3px] border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </Field>
            <Field label={tA.country ?? "Country"} className="sm:col-span-2">
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full rounded-[3px] border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </Field>
          </div>
        </div>

        <div className="border-t border-zinc-100 px-5 py-3 flex items-center justify-end gap-2 bg-zinc-50/50">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-[3px] border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            {dict?.common?.cancel ?? "Cancel"}
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-[3px] bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-75"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {tA.submit ?? "Create customer"}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}

function Field({ label, required, children, className = "" }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-sm font-medium text-zinc-700 mb-1">
        {label}
        {required && <span className="text-rose-500"> *</span>}
      </span>
      {children}
    </label>
  );
}
