import { buildDisplayAttributes, attrLabel } from "@/lib/product-attributes";

/**
 * Renders a product's type-specific attributes on the public details page,
 * driven by the same product-type schema used in the admin wizard. Only
 * attributes that have a value are shown; nothing renders when the product
 * has no type or no populated attributes.
 *
 * When the product ships configurable RAM/Storage variants, the RAM and
 * Storage rows list every available option instead of a single value.
 */
export default function ProductSpecs({ product, dict }) {
  // Device type is shown by the storefront selector, not repeated here.
  const groups = buildDisplayAttributes(product?.product_type, product?.attributes, dict)
    .filter((g) => g.id !== "device");

  // All RAM / Storage options offered as configurable variants.
  const v = product?.variants;
  const ramOpts = v?.ram_enabled && Array.isArray(v.ram_options) && v.ram_options.length ? v.ram_options : null;
  const storageOpts = v?.storage_enabled && Array.isArray(v.storage_options) && v.storage_options.length ? v.storage_options : null;

  // Ensure RAM/Storage rows exist even when the plain attribute wasn't filled.
  if (ramOpts || storageOpts) {
    const target = groups.find((g) => g.id !== "device") ?? groups[groups.length - 1];
    const ensureRow = (key, opts) => {
      if (!opts) return;
      const exists = groups.some((g) => g.items.some((it) => it.key === key));
      if (!exists) {
        const row = { key, label: attrLabel(dict, key, key === "ram" ? "RAM" : "Storage"), value: opts.join(", ") };
        if (target) target.items.push(row);
        else groups.push({ id: "specs", label: dict?.admin?.products?.attr_groups?.specs ?? "Specifications", items: [row] });
      }
    };
    ensureRow("ram", ramOpts);
    ensureRow("storage", storageOpts);
  }

  if (groups.length === 0) return null;

  const optionsFor = (key) => (key === "ram" ? ramOpts : key === "storage" ? storageOpts : null);
  const specsTitle = dict?.product?.specifications ?? "Specifications";

  return (
    <section className="mt-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-900 mb-3">
        {specsTitle}
      </h2>
      <div className="overflow-hidden rounded-[5px] border border-zinc-200">
        {groups.map((group, gi) => (
          <div key={group.id} className={gi > 0 ? "border-t border-zinc-200" : undefined}>
            {groups.length > 1 && group.label !== specsTitle && (
              <div className="bg-zinc-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                {group.label}
              </div>
            )}
            <dl className="divide-y divide-zinc-100">
              {group.items.map((item) => {
                const opts = optionsFor(item.key);
                return (
                  <div
                    key={item.key}
                    className="grid grid-cols-3 items-start gap-4 px-4 py-3 odd:bg-white even:bg-zinc-50/50"
                  >
                    <dt className="col-span-1 text-sm text-zinc-500">{item.label}</dt>
                    <dd className="col-span-2 text-end">
                      {opts ? (
                        <span className="inline-flex flex-wrap justify-end gap-1.5">
                          {opts.map((o) => (
                            <span
                              key={o}
                              className="inline-flex items-center rounded-md border border-zinc-200 bg-white px-2 py-0.5 text-xs font-medium text-zinc-700"
                            >
                              {o}
                            </span>
                          ))}
                        </span>
                      ) : (
                        <span className="text-sm font-medium text-zinc-900 break-words">{item.value}</span>
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>
        ))}
      </div>
    </section>
  );
}
