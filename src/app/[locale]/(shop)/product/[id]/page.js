import { notFound } from "next/navigation";
import { ChevronRight, Star } from "lucide-react";
import { productService } from "@/modules/products/product.service";
import { getDictionary } from "@/i18n/getDictionary";
import ProductGallery from "./_components/ProductGallery";
import ProductPurchasePanel from "./_components/ProductPurchasePanel";
import ProductPageHeader from "./_components/ProductPageHeader";
import ProductPrice from "./_components/ProductPrice";
import ProductSections from "@/components/shop/product-sections/ProductSections";
import { productSectionService } from "@/modules/product-sections/service";
import { getSectionComponent } from "@/components/shop/product-sections/registry";

export default async function ProductDetailsPage({ params }) {
  const { locale, id } = await params;
  const dict = await getDictionary(locale);

  let product;
  try {
    product = await productService.getProductById(id, locale);
    if (!product || product.status !== "active") return notFound();
  } catch {
    return notFound();
  }

  const isDiscounted = product.effective_price < product.price;

  const colors = Array.isArray(product.colors) ? product.colors : [];
  const sizes = Array.isArray(product.sizes) ? product.sizes : [];
  const hasColors = colors.length > 0;
  const hasSizes = sizes.length > 0;

  const soldCount = 0;
  const rating = 0;
  const reviewCount = 0;

  // Resolve effective sections to detect inline checkout
  const globalDefaults = await productSectionService.getGlobalDefaults();
  const resolvedSections = productSectionService.resolveForProduct(product, globalDefaults, locale);
  const checkoutSection = resolvedSections.find((s) => s.type === "checkout") ?? null;
  const hasCheckoutSection = !!checkoutSection;
  const CheckoutCmp = checkoutSection ? getSectionComponent("checkout") : null;

  return (
    <div className="min-h-screen bg-white">
      <ProductPageHeader />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-20 pb-10 lg:py-10 lg:pt-20">
        <nav className="flex items-center gap-1.5 text-sm text-zinc-500 mb-8">
          <a href={`/${locale}`} className="hover:text-zinc-900">{dict?.product?.homepage ?? "Homepage"}</a>
          {product.category && (
            <>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="hover:text-zinc-900">{product.category}</span>
            </>
          )}
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-zinc-900 font-medium truncate max-w-xs">{product.name}</span>
        </nav>

        <div className="lg:grid lg:grid-cols-2 lg:gap-x-12 xl:gap-x-16">
          <div className="relative pb-20 lg:pb-0">
            <ProductGallery images={product.images} productName={product.name} productId={product.id} />
          </div>

          <div className="mt-10 lg:mt-0">            {product.category && (
              <p className="text-sm text-zinc-500 mb-2">{product.category}</p>
            )}

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900">
              {product.name}
            </h1>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-y-3 border-b border-zinc-100 pb-5">
              <ProductPrice price={product.price} effectivePrice={product.effective_price} />
              <div className="flex items-center gap-4 text-sm text-zinc-600">
                {soldCount > 0 && (
                  <>
                    <span>{soldCount.toLocaleString()} {dict?.product?.sold ?? "Sold"}</span>
                    <span className="text-zinc-300">•</span>
                  </>
                )}
                {rating > 0 ? (
                  <span className="flex items-center gap-1">
                    <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                    <span className="font-semibold">{rating.toFixed(1)}</span>
                    {reviewCount > 0 && <span className="text-zinc-400">({reviewCount})</span>}
                  </span>
                ) : (
                  <span className="text-zinc-400 text-xs">{dict?.product?.no_reviews ?? "No reviews yet"}</span>
                )}
              </div>
            </div>

            {product.description && (
              <div className="mt-6">
                <h3 className="font-semibold text-zinc-900 mb-2">{dict?.product?.description ?? "Description"}:</h3>
                <p className="text-sm text-zinc-600 leading-relaxed whitespace-pre-line line-clamp-3">
                  {product.description}
                </p>
              </div>
            )}

            <ProductPurchasePanel
              product={product}
              colors={colors}
              sizes={sizes}
              hasColors={hasColors}
              hasSizes={hasSizes}
              dict={dict}
              hideCheckoutNow={hasCheckoutSection}
            />

            {/* Inline checkout section — rendered in the product info column */}
            {CheckoutCmp && checkoutSection && (
              <div className="mt-6">
                <CheckoutCmp section={checkoutSection} product={product} locale={locale} dict={dict} compact={true} />
              </div>
            )}
          </div>
        </div>

        {/* Dynamic, admin-configurable sections (description / specs / FAQ / etc.) */}
        <ProductSections
          product={product}
          locale={locale}
          dict={dict}
          excludeTypes={hasCheckoutSection ? ["checkout"] : []}
        />
      </main>
    </div>
  );
}
