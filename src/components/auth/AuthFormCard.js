"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function AuthFormCard({
  title,
  subtitle,
  error,
  backHref = "/",
  backLabel,
  children,
  footer,
}) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="absolute top-0 left-0 w-full flex h-16 items-center px-4 sm:px-8 bg-white border-b border-zinc-200">
        <Link
          href={backHref}
          aria-label={backLabel}
          className="p-2 text-zinc-500 transition-colors hover:text-zinc-900"
        >
          <ArrowLeft className="h-6 w-6" />
        </Link>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center px-4 pt-24 pb-12 sm:px-8 sm:pt-32">
        <div className="w-full max-w-md">
          <div className="mx-auto w-full sm:rounded-2xl sm:border border-transparent sm:border-zinc-200 bg-white px-2 py-8 sm:p-10">
            <h1 className="mb-2 text-3xl font-bold text-zinc-900">{title}</h1>
            {subtitle && (
              <p className="mb-8 text-sm text-zinc-500">{subtitle}</p>
            )}

            {error && (
              <div className="mb-6 rounded-md bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            )}

            {children}

            {footer && (
              <p className="mt-8 text-center text-sm text-zinc-500">{footer}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
