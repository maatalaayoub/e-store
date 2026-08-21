"use client";

/**
 * Reusable SEO preview + validation widgets for the admin dashboard.
 *
 * - SeoSearchPreview: Google-style SERP snippet.
 * - SeoSocialPreview: Open Graph / social share card.
 * - SeoFindings: real-time validation list (uses analyze codes).
 *
 * All presentational + client-safe; they take already-resolved values so the
 * same components serve both the store settings and the product form.
 */

import { AlertTriangle, CheckCircle2, XCircle, Info, Globe, ImageIcon } from "lucide-react";

export function SeoSearchPreview({ title, url, description, favicon }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex items-center gap-2 mb-1.5">
        {favicon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={favicon} alt="" className="h-4 w-4 rounded-sm object-cover" />
        ) : (
          <Globe className="h-4 w-4 text-zinc-400" />
        )}
        <span className="text-xs text-zinc-600 truncate">{url || "https://example.com"}</span>
      </div>
      <div className="text-[19px] leading-6 text-[#1a0dab] truncate">
        {title || "Untitled page"}
      </div>
      <p className="mt-1 text-sm text-[#4d5156] leading-snug line-clamp-2">
        {description || "No meta description provided."}
      </p>
    </div>
  );
}

export function SeoSocialPreview({ title, description, image, siteName, url }) {
  let host = "";
  try {
    host = url ? new URL(url).host : "";
  } catch {
    host = siteName || "";
  }
  return (
    <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden max-w-md">
      <div className="aspect-[1.91/1] bg-zinc-100 flex items-center justify-center overflow-hidden">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-1 text-zinc-400">
            <ImageIcon className="h-8 w-8" />
            <span className="text-xs">No image</span>
          </div>
        )}
      </div>
      <div className="p-3 border-t border-zinc-100">
        {(host || siteName) && (
          <div className="text-[11px] uppercase tracking-wide text-zinc-500 truncate">
            {host || siteName}
          </div>
        )}
        <div className="text-sm font-semibold text-zinc-900 truncate">
          {title || "Untitled"}
        </div>
        <p className="text-xs text-zinc-600 line-clamp-2">
          {description || "No description."}
        </p>
      </div>
    </div>
  );
}

const LEVEL_STYLE = {
  error: { Icon: XCircle, cls: "text-red-600" },
  warning: { Icon: AlertTriangle, cls: "text-amber-600" },
  good: { Icon: CheckCircle2, cls: "text-emerald-600" },
  info: { Icon: Info, cls: "text-blue-600" },
};

export function SeoFindings({ findings, labels }) {
  if (!findings?.length) return null;
  // Errors first, then warnings, then positive signals.
  const order = { error: 0, warning: 1, info: 2, good: 3 };
  const sorted = [...findings].sort((a, b) => (order[a.level] ?? 9) - (order[b.level] ?? 9));

  return (
    <ul className="space-y-1.5">
      {sorted.map((f, i) => {
        const { Icon, cls } = LEVEL_STYLE[f.level] ?? LEVEL_STYLE.info;
        const text = labels?.[f.code] ?? f.code;
        return (
          <li key={`${f.code}-${i}`} className="flex items-start gap-2 text-sm">
            <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${cls}`} />
            <span className="text-zinc-700">{text}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** Small colored counter badges summarizing findings. */
export function SeoScoreBadges({ summary, labels }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {summary.error > 0 && (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 text-red-700 px-2 py-0.5">
          <XCircle className="h-3 w-3" /> {summary.error} {labels?.errors ?? "issues"}
        </span>
      )}
      {summary.warning > 0 && (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 px-2 py-0.5">
          <AlertTriangle className="h-3 w-3" /> {summary.warning} {labels?.warnings ?? "warnings"}
        </span>
      )}
      {summary.good > 0 && (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5">
          <CheckCircle2 className="h-3 w-3" /> {summary.good} {labels?.passed ?? "passed"}
        </span>
      )}
    </div>
  );
}
