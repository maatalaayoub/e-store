"use client";

import Link from "next/link";
import Image from "next/image";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useDictionary } from "@/components/providers/LocaleProvider";
import { isRtlLocale } from "@/config/constants";
import { getSiteOrigin } from "@/lib/url";
import AuthFormCard from "@/components/auth/AuthFormCard";
import FormInput from "@/components/auth/FormInput";
import { AuthFormSkeleton } from "@/components/skeletons";

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { locale } = useParams();
  const isRtl = isRtlLocale(locale);
  const supabase = createClient();
  const dict = useDictionary();
  const t = dict?.auth?.signup ?? {};
  const tCommon = dict?.common ?? {};
  const tBack = dict?.auth?.back_home;

  // Show skeleton until locale dictionary is available
  if (!dict?.auth?.signup) return <AuthFormSkeleton />;

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
    } else {
      router.push(`/${locale}/login?message=Check your email to verify your account`);
    }
  };

  const handleGoogleSignup = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${getSiteOrigin()}/auth/callback` },
    });
  };

  return (
    <AuthFormCard
      title={t.title}
      subtitle={t.subtitle}
      error={error}
      backHref={`/${locale}`}
      backLabel={tBack}
      footer={
        <>
          {t.have_account}{" "}
          <Link
            href={`/${locale}/login`}
            className="font-semibold text-zinc-900 hover:underline"
          >
            {t.login_link}
          </Link>
        </>
      }
    >
      <form className="flex flex-col gap-5" onSubmit={handleSignup}>
        <FormInput
          label={t.full_name_label}
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder={t.full_name_placeholder}
          required
        />
        <FormInput
          label={t.email_label}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t.email_placeholder}
          required
        />
        <FormInput
          label={t.password_label}
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t.password_placeholder}
          required
          isRtl={isRtl}
          rightSlot={
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="text-zinc-400 hover:text-zinc-600"
              aria-label="Toggle password visibility"
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          }
        />

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            required
            id="terms"
            className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-600"
          />
          <label htmlFor="terms" className="text-sm text-zinc-600">
            {t.accept_prefix}{" "}
            <a href="#" className="font-semibold text-zinc-900 hover:underline">
              {t.terms_link}
            </a>
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-4 flex w-full justify-center items-center gap-2 rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : t.submit}
        </button>
      </form>

      <div className="my-6 flex items-center justify-between">
        <hr className="w-full border-zinc-200" />
        <span className="p-2 text-xs text-zinc-400">{tCommon.or}</span>
        <hr className="w-full border-zinc-200" />
      </div>

      <div className="flex gap-4">
        <button
          onClick={handleGoogleSignup}
          type="button"
          className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white py-2.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50"
        >
          <Image
            src="/images/icons_google.png"
            alt="Google"
            width={20}
            height={20}
            className="object-contain"
          />
          Google
        </button>
        <button
          type="button"
          className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white py-2.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50"
        >
          <Image
            src="/images/icon_facebook.png"
            alt="Facebook"
            width={20}
            height={20}
            className="object-contain"
          />
          Facebook
        </button>
      </div>
    </AuthFormCard>
  );
}
