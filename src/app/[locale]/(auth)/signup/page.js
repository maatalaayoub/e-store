"use client";

import Link from "next/link";
import Image from "next/image";
import { Eye, ArrowLeft, Loader2 } from "lucide-react";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
    } else {
      router.push("/login?message=Check your email to verify your account");
    }
  };

  const handleGoogleSignup = async () => {
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${location.origin}/auth/callback` } });
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* HEADER WITH BACK BUTTON */}
      <header className="absolute top-0 left-0 w-full flex h-16 items-center px-4 sm:px-8 bg-white border-b border-zinc-200">
        <Link href="/" className="p-2 text-zinc-500 transition-colors hover:text-zinc-900" aria-label="Back to Home">
          <ArrowLeft className="h-6 w-6" />
        </Link>
      </header>

      {/* MAIN CONTENT */}
      <div className="flex flex-1 flex-col items-center justify-center px-4 pt-24 pb-12 sm:px-8 sm:pt-32">
        <div className="w-full max-w-md">
          <div className="mx-auto w-full sm:rounded-2xl sm:border border-transparent sm:border-zinc-200 bg-white px-2 py-8 sm:p-10">
          
          <h1 className="mb-2 text-3xl font-bold text-zinc-900">Create an account</h1>
          <p className="mb-8 text-sm text-zinc-500">Welcome! Enter your details to sign up</p>
          
          {error && (
            <div className="mb-6 rounded-md bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          <form className="flex flex-col gap-5" onSubmit={handleSignup}>
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-900">Full Name</label>
              <input 
                type="text" 
                placeholder="Enter your Full name" 
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-4 py-2.5 text-sm placeholder-zinc-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-900">Email address</label>
              <input 
                type="email" 
                placeholder="Enter your email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-4 py-2.5 text-sm placeholder-zinc-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-900">Password</label>
              <div className="relative">
                <input 
                  type="password" 
                  placeholder="Enter your password" 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 px-4 py-2.5 text-sm placeholder-zinc-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600" aria-label="Toggle password visibility">
                  <Eye className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <input type="checkbox" required id="terms" className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-600" />
              <label htmlFor="terms" className="text-sm text-zinc-600">
                I accept <a href="#" className="font-semibold text-zinc-900 hover:underline">Terms & Conditions</a>
              </label>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="mt-4 flex w-full justify-center items-center gap-2 rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin"/> : "Sign Up"}
            </button>
          </form>
          <div className="my-6 flex items-center justify-between">
             <hr className="w-full border-zinc-200" />
             <span className="p-2 text-xs text-zinc-400">OR</span>
             <hr className="w-full border-zinc-200" />
          </div>

          <div className="flex gap-4">
            <button onClick={handleGoogleSignup} type="button" className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white py-2.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50">
              <Image src="/images/icons_google.png" alt="Google" width={20} height={20} className="object-contain" />
              Google
            </button>
            <button className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white py-2.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50">
              <Image src="/images/icon_facebook.png" alt="Facebook" width={20} height={20} className="object-contain" />
              Facebook
            </button>
          </div>
          <p className="mt-8 text-center text-sm text-zinc-500">
            Already have an account? <Link href="/login" className="font-semibold text-zinc-900 hover:underline">Log in</Link>
          </p>
        </div>
      </div>
      </div>
    </div>
  );
}