"use client";

import Link from "next/link";
import Image from "next/image";
import { Eye, Loader2 } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useDictionary } from "@/components/providers/LocaleProvider";
import { getSiteOrigin } from "@/lib/url";
import AuthFormCard from "@/components/auth/AuthFormCard";
import FormInput from "@/components/auth/FormInput";
import { AuthFormSkeleton } from "@/components/skeletons";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const dict = useDictionary();
  const t = dict?.auth?.login ?? {};
  const tCommon = dict?.common ?? {};
  const tBack = dict?.auth?.back_home;

  // Show skeleton until locale dictionary is available
  if (!dict?.auth?.login) return <AuthFormSkeleton />;

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) {
      setError(signInError.message);
      setLoading(false);
    } else {
      const user = data?.user;
      const role = user?.user_metadata?.role || user?.app_metadata?.role;
      router.push(role === "admin" ? "/admin" : "/");
      router.refresh();
    }
  };

  const handleGoogleLogin = async () => {
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
      backLabel={tBack}
      footer={
        <>
          {t.no_account}{" "}
          <Link
            href="/signup"
            className="font-semibold text-zinc-900 hover:underline"
          >
            {t.signup_link}
          </Link>
        </>
      }
    >
      <form className="flex flex-col gap-5" onSubmit={handleLogin}>
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
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t.password_placeholder}
          required
          rightSlot={
            <button
              type="button"
              className="text-zinc-400 hover:text-zinc-600"
              aria-label="Toggle password visibility"
            >
              <Eye className="h-5 w-5" />
            </button>
          }
        />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="remember"
              className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-600"
            />
            <label htmlFor="remember" className="text-sm text-zinc-600">
              {t.remember}
            </label>
          </div>
          <a href="#" className="text-sm font-medium text-blue-600 hover:underline">
            {t.forgot}
          </a>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed"
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
          onClick={handleGoogleLogin}
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
