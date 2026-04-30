// SSR-safe origin resolver. Falls back to NEXT_PUBLIC_SITE_URL on the server.
export function getSiteOrigin() {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_SITE_URL ?? "";
}
