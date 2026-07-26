"use client";

import { createClient } from "@/lib/supabase/client";

// Shared bucket for user-uploaded product-related media. Category icons live
// under the `categories/` prefix so RLS + `sanitizeImagePath` on the server
// keep them isolated from product photos.
export const CATEGORY_IMAGE_BUCKET = "product-images";
export const MAX_CATEGORY_IMAGE_BYTES = 3 * 1024 * 1024; // 3 MB — icons don't need to be huge
export const ACCEPTED_CATEGORY_IMAGE_TYPES =
  "image/png,image/jpeg,image/webp,image/avif,image/gif,image/svg+xml";

const ACCEPTED_SET = new Set(ACCEPTED_CATEGORY_IMAGE_TYPES.split(","));

/**
 * Client-side type + size check. Returns null when valid, or a translation key
 * (`invalid_type` / `too_large`) the caller can look up in its dictionary and
 * surface via toast.
 */
export function validateCategoryImage(file) {
  if (!file) return "invalid_type";
  if (!ACCEPTED_SET.has(file.type)) return "invalid_type";
  if (file.size > MAX_CATEGORY_IMAGE_BYTES) return "too_large";
  return null;
}

/**
 * Upload a category icon directly to Supabase storage and return the storage
 * path (NOT the public URL). The server derives the URL after validating the
 * path against the `categories/` prefix in `sanitizeImagePath`.
 */
export async function uploadCategoryImage(file) {
  const supabase = createClient();
  const rawExt = file.name.includes(".") ? file.name.split(".").pop() : "";
  const ext = /^[a-z0-9]{1,5}$/i.test(rawExt) ? rawExt.toLowerCase() : "png";
  const path = `categories/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(CATEGORY_IMAGE_BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type });
  if (error) throw error;
  return path;
}
