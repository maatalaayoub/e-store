/**
 * Order → FullCalendar event mapping (Phase 3).
 *
 * Pure helpers shared by the calendar container. No business logic is
 * duplicated here — orders arrive already normalised from GET /api/v1/orders;
 * we only reshape them into FullCalendar event objects and expose the
 * per-status visual metadata used by both the chips and the CSS overrides.
 */

// Status → visual metadata. `dot` matches the pills used on the orders list;
// `chip` is the class the CSS overrides use to tint the event background.
export const STATUS_META = {
  pending: { dot: "bg-amber-400", chip: "oc-ev-pending" },
  confirmed: { dot: "bg-blue-500", chip: "oc-ev-confirmed" },
  processing: { dot: "bg-violet-500", chip: "oc-ev-processing" },
  shipped: { dot: "bg-indigo-500", chip: "oc-ev-shipped" },
  delivered: { dot: "bg-emerald-500", chip: "oc-ev-delivered" },
  cancelled: { dot: "bg-red-400", chip: "oc-ev-cancelled" },
};

export function statusMeta(status) {
  return STATUS_META[status] ?? STATUS_META.pending;
}

/** Base MAD amount → short display string, e.g. "1,250 DH". */
export function formatMadShort(amount) {
  const n = Number(amount ?? 0);
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 0 })} DH`;
}

/**
 * Map raw order rows to FullCalendar event objects.
 * `created_at` is an ISO string with a UTC offset; FullCalendar parses it and
 * renders in the browser's local timezone (correct for an admin viewing).
 */
export function ordersToEvents(orders = []) {
  if (!Array.isArray(orders)) return [];
  return orders.map((o) => {
    const status = o.status ?? "pending";
    const meta = statusMeta(status);
    const orderNumber = o.order_number ?? o.id?.slice(0, 8) ?? "";
    return {
      id: o.id,
      title: `#${orderNumber}`,
      start: o.created_at,
      classNames: ["oc-ev", meta.chip],
      extendedProps: {
        orderId: o.id,
        orderNumber,
        status,
        customerName: o.shipping_address?.full_name ?? null,
        total: Number(o.total_amount ?? 0),
      },
    };
  });
}
