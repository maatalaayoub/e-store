"use client";

/**
 * Client-side image downscaling + compression run before uploading product
 * media to Supabase. Large originals (multi-MB PNGs) make Next's image
 * optimizer time out when it re-fetches them, so we cap dimensions and
 * re-encode to WebP to keep stored objects small.
 *
 * Vector (SVG) and animated (GIF) sources are passed through untouched since
 * a canvas would rasterize/flatten them.
 */
export async function compressImageFile(file, opts = {}) {
  const { maxDim = 1600, quality = 0.8, mimeType = "image/webp" } = opts;

  if (!file || !file.type?.startsWith("image/")) return file;
  if (file.type === "image/svg+xml" || file.type === "image/gif") return file;
  if (typeof document === "undefined" || typeof createImageBitmap !== "function") return file;

  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file; // Undecodable here — let the server/original handle it.
  }

  const { width, height } = bitmap;
  const scale = Math.min(1, maxDim / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close?.();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, mimeType, quality));
  if (!blob) return file;

  // Keep the original when re-encoding didn't actually shrink it and no
  // downscale happened (e.g. already-tiny WebP).
  if (blob.size >= file.size && scale === 1) return file;

  const base = file.name?.replace(/\.[^.]+$/, "") || "image";
  const ext = mimeType === "image/jpeg" ? "jpg" : mimeType === "image/png" ? "png" : "webp";
  return new File([blob], `${base}.${ext}`, { type: mimeType });
}
