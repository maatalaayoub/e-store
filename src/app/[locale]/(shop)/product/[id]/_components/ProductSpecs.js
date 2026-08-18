import { buildDisplayAttributes } from "@/lib/product-attributes";

/**
 * Renders a product's type-specific attributes on the public details page,
 * driven by the same product-type schema used in the admin wizard. Only
 * attributes that have a value are shown; nothing renders when the product
 * has no type or no populated attributes.
 */
export default function ProductSpecs({ product, dict }) {
  const groups = buildDisplayAttributes(product?.product_type, product?.attributes, dict);
  if (groups.length === 0) return null;

  return (
    <section className="mt-6 border-t border-zinc-100 pt-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-900 mb-3">
        {dict?.product?.specifications ?? "Specifications"}
      </h2>
      <div className="space-y-5">
        {groups.map((group) => (
          <div key={group.id}>
            {groups.length > 1 && (
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-2">
                {group.label}
              </h3>
            )}
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
              {group.items.map((item) => (
                <div
                  key={item.key}
                  className="flex items-baseline justify-between gap-4 border-b border-zinc-50 py-1.5"
                >
                  <dt className="text-sm text-zinc-500 shrink-0">{item.label}</dt>
                  <dd className="text-sm font-medium text-zinc-900 text-end break-words">{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </section>
  );
}
