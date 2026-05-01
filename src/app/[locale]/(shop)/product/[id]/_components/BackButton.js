"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function BackButton() {
  const router = useRouter();
  return (
    <button
      onClick={() => router.back()}
      aria-label="Go back"
      className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-700 hover:bg-zinc-100 transition-colors"
    >
      <ArrowLeft className="h-5 w-5" />
    </button>
  );
}
