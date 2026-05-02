'use client';

import { useCurrency } from '@/components/providers/CurrencyProvider';

/**
 * Renders the price section on the product detail page.
 * Accepts raw MAD values — converts to the visitor's local currency.
 */
export default function ProductPrice({ price, effectivePrice }) {
  const { formatPrice } = useCurrency();

  const isDiscounted =
    effectivePrice != null &&
    price != null &&
    Number(effectivePrice) < Number(price);

  return (
    <div className="flex items-baseline gap-3">
      {isDiscounted && (
        <span className="text-lg text-zinc-400 line-through">
          {formatPrice(price)}
        </span>
      )}
      <span className="text-2xl sm:text-3xl font-bold text-zinc-900">
        {formatPrice(effectivePrice ?? price)}
      </span>
    </div>
  );
}
