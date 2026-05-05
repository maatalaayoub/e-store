import {
  Clock,
  Truck,
  Package,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";

/**
 * Centralized order status configuration.
 * Each entry contains an Icon component plus Tailwind color tokens.
 *
 * Note: `processing` ships in two variants used across the app:
 *   - orders/page.js uses the spinning Loader2 (blue)
 *   - track-order/page.js uses the static Package (violet)
 * They are exposed via dedicated keys to preserve existing visuals.
 */
export const ORDER_STATUS_CONFIG = {
  pending:    { Icon: Clock,        color: "text-amber-600",   bg: "bg-amber-50",   border: "border-amber-200" },
  confirmed:  { Icon: CheckCircle2, color: "text-blue-600",    bg: "bg-blue-50",    border: "border-blue-200"  },
  processing: { Icon: Loader2,      color: "text-blue-600",    bg: "bg-blue-50",    border: "border-blue-200"  },
  shipped:    { Icon: Truck,        color: "text-indigo-600",  bg: "bg-indigo-50",  border: "border-indigo-200"},
  delivered:  { Icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200"},
  cancelled:  { Icon: XCircle,      color: "text-red-600",     bg: "bg-red-50",     border: "border-red-200"   },
};

/**
 * Variant of ORDER_STATUS_CONFIG used by the public Track Order page,
 * where "processing" is shown as a static Package icon (no spinner).
 */
export const TRACK_ORDER_STATUS_CONFIG = {
  ...ORDER_STATUS_CONFIG,
  processing: { Icon: Package, color: "text-violet-600", bg: "bg-violet-50", border: "border-violet-200" },
};

/**
 * Build a localized status config by merging translated labels with icons/colors.
 * @param {object} tStatus i18n object like dict.orders.status
 * @param {object} [base] base config (defaults to ORDER_STATUS_CONFIG)
 */
export function buildStatusConfig(tStatus = {}, base = ORDER_STATUS_CONFIG) {
  return Object.fromEntries(
    Object.entries(base).map(([key, cfg]) => [
      key,
      { ...cfg, label: tStatus[key] ?? key.charAt(0).toUpperCase() + key.slice(1) },
    ])
  );
}
