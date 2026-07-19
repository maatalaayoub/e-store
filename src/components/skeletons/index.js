import { SkeletonImage, SkeletonText, SkeletonButton } from "./primitives";

// Mirrors iHerb-style hero — mobile: single banner + dots; desktop: main + side cards.
export function HeroIherbSkeleton({ hasSideCards = true } = {}) {
  return (
    <section
      className="w-full lg:px-8 xl:px-12 lg:pt-[calc(var(--iherb-offset)+1rem)]"
      style={{ '--iherb-offset': 'calc(var(--bar-height, 0px) + var(--header-height, 3.5rem))' }}
    >
      {/* Mobile: single full-width banner with overlaid pagination dots */}
      <div className="relative lg:hidden">
        <SkeletonImage className="w-full aspect-[16/9]" />
        <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-2">
          <div className="h-2 w-5 rounded-full bg-white/80" />
          <div className="h-2 w-2 rounded-full bg-white/50" />
          <div className="h-2 w-2 rounded-full bg-white/50" />
        </div>
      </div>

      {/* Desktop: main banner + side cards column */}
      <div className="hidden lg:grid lg:grid-cols-[2fr_1fr] gap-4">
        <SkeletonImage className="w-full aspect-[16/9] rounded-xl" />
        {hasSideCards && (
          <div className="flex flex-col gap-4">
            <SkeletonImage className="flex-1 min-h-[160px] rounded-xl" />
            <SkeletonImage className="flex-1 min-h-[160px] rounded-xl" />
          </div>
        )}
      </div>
    </section>
  );
}

// Shared full-viewport hero shell used by slider/single/multi/video/countdown.
// Reproduces the real heroes' -mt-[1px], 100svh height and dark overlay so the
// swap to the loaded hero is seamless.
function HeroFullShell({ children, contentClassName = "" }) {
  return (
    <section className="relative h-[100svh] w-full overflow-hidden -mt-[1px]">
      <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-zinc-300 via-zinc-200 to-zinc-300" />
      <div className="absolute inset-0 bg-black/25" />
      <div className={`relative z-10 flex h-full w-full flex-col items-center justify-center gap-8 px-6 ${contentClassName}`}>
        {children}
      </div>
    </section>
  );
}

// Slider-progress / dot indicators pinned to the bottom center.
// Rendered inside a HeroFullShell so its absolute positioning resolves to the section.
function HeroDots() {
  return (
    <div className="absolute bottom-10 left-1/2 z-10 -translate-x-1/2 flex items-center gap-3">
      <div className="h-[2px] w-12 rounded bg-white/50" />
      <div className="h-[2px] w-6 rounded bg-white/25" />
      <div className="h-[2px] w-6 rounded bg-white/25" />
    </div>
  );
}

// Mirrors HeroCarousel (slider) — centered heading + CTA + slide indicators.
export function HeroCarouselSkeleton() {
  return (
    <HeroFullShell>
      <div className="flex w-full max-w-xl flex-col items-center gap-4">
        <div className="h-12 w-4/5 rounded bg-white/20 sm:h-16 md:h-20" />
        <div className="h-4 w-2/3 rounded bg-white/15" />
      </div>
      <div className="h-11 w-44 rounded bg-white/20" />
      <HeroDots />
    </HeroFullShell>
  );
}

// Mirrors HeroSingleImage — a single static image with a large centered title + CTA.
export function HeroSingleSkeleton() {
  return (
    <HeroFullShell>
      <div className="flex w-full max-w-3xl flex-col items-center gap-4">
        <div className="h-10 w-3/4 rounded bg-white/20 sm:h-14 md:h-16" />
        <div className="h-4 w-1/2 rounded bg-white/15" />
      </div>
      <div className="h-11 w-52 rounded bg-white/20" />
    </HeroFullShell>
  );
}

// Mirrors HeroMultiImage — rotating gallery with centered content + rotation dots.
export function HeroMultiSkeleton() {
  return (
    <HeroFullShell>
      <div className="flex w-full max-w-xl flex-col items-center gap-4">
        <div className="h-12 w-4/5 rounded bg-white/20 sm:h-16 md:h-20" />
        <div className="h-4 w-2/3 rounded bg-white/15" />
      </div>
      <div className="h-11 w-44 rounded bg-white/20" />
      <div className="absolute bottom-10 left-1/2 z-10 -translate-x-1/2 flex items-center gap-2.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={`h-2.5 rounded-full ${i === 0 ? "w-6 bg-white/60" : "w-2.5 bg-white/30"}`} />
        ))}
      </div>
    </HeroFullShell>
  );
}

// Mirrors HeroVideo — full-screen video with a centered play affordance + content.
export function HeroVideoSkeleton() {
  return (
    <HeroFullShell>
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/25 sm:h-20 sm:w-20">
        <div className="ml-1 h-0 w-0 border-y-[10px] border-l-[16px] border-y-transparent border-l-white/70 sm:border-y-[13px] sm:border-l-[20px]" />
      </div>
      <div className="flex w-full max-w-xl flex-col items-center gap-4">
        <div className="h-10 w-3/4 rounded bg-white/20 sm:h-14" />
        <div className="h-4 w-1/2 rounded bg-white/15" />
      </div>
      <div className="h-11 w-44 rounded bg-white/20" />
    </HeroFullShell>
  );
}

// Mirrors HeroCountdown — centered heading, countdown blocks and CTA.
export function HeroCountdownSkeleton() {
  return (
    <HeroFullShell>
      <div className="flex w-full max-w-xl flex-col items-center gap-4">
        <div className="h-10 w-3/4 rounded bg-white/20 sm:h-14" />
        <div className="h-4 w-1/2 rounded bg-white/15" />
      </div>
      <div className="flex items-center gap-3 sm:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <div className="h-16 w-16 rounded-lg bg-white/20 sm:h-20 sm:w-20" />
            <div className="h-2.5 w-10 rounded bg-white/15" />
          </div>
        ))}
      </div>
      <div className="h-11 w-44 rounded bg-white/20" />
    </HeroFullShell>
  );
}

// Dispatcher: returns the skeleton matching the configured hero type so the
// loading placeholder matches whatever hero will render.
export function HeroSkeleton({ type = "slider", hasSideCards = true } = {}) {
  switch (type) {
    case "iherb":
      return <HeroIherbSkeleton hasSideCards={hasSideCards} />;
    case "single":
      return <HeroSingleSkeleton />;
    case "multi":
      return <HeroMultiSkeleton />;
    case "video":
      return <HeroVideoSkeleton />;
    case "countdown":
      return <HeroCountdownSkeleton />;
    case "slider":
    default:
      return <HeroCarouselSkeleton />;
  }
}

// Mirrors ProductCard.js exactly:
//   - aspect-square image area
//   - 2-line product name (uppercase, tight tracking)
//   - price line
//   - full-width border button
export function ProductCardSkeleton() {
  return (
    <article className="flex flex-col h-full">
      {/* Image */}
      <SkeletonImage className="aspect-square w-full" />

      {/* Info */}
      <div className="mt-4 sm:mt-5 flex flex-1 flex-col items-center text-center">
        <SkeletonText lines={2} className="w-4/5" lastLineWidth="55%" />
        <div className="mt-2 w-1/3">
          <SkeletonText className="h-3 w-full" />
        </div>
        <div className="mt-auto pt-4 w-full">
          <SkeletonButton className="h-10 sm:h-11 rounded-none" />
        </div>
      </div>
    </article>
  );
}

// Mirrors FeaturedProducts.js exactly:
//   - kicker + heading + view-all link row
//   - 6-card grid (2 cols mobile, 3 cols desktop)
export function FeaturedProductsSkeleton() {
  return (
    <section className="bg-white px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-7xl">
        {/* Header row */}
        <div className="mb-14 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
          <div className="flex flex-col gap-3">
            <div className="animate-pulse rounded bg-zinc-300 h-2.5 w-24" />
            <div className="animate-pulse rounded bg-zinc-300 h-8 w-64 sm:h-10 sm:w-80" />
          </div>
          <div className="animate-pulse rounded bg-zinc-300 h-3 w-20" />
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-12 lg:grid-cols-3 xl:gap-x-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

// Cart item skeleton — mirrors cart item rows in CartSidebar
function CartItemSkeleton() {
  return (
    <div className="flex gap-3">
      <SkeletonImage className="h-20 w-20 shrink-0 rounded-xl" />
      <div className="flex flex-1 flex-col gap-2 py-1">
        <SkeletonText lines={2} className="w-full" lastLineWidth="60%" />
        <div className="w-1/4">
          <SkeletonText className="h-3 w-full" />
        </div>
        <div className="mt-auto flex items-center justify-between pt-1">
          <div className="animate-pulse rounded-full bg-zinc-200 h-7 w-24" />
          <div className="animate-pulse rounded bg-zinc-200 h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

// Mirrors the open cart sidebar (items list + footer)
export function CartSkeleton() {
  return (
    <div className="flex flex-col h-full">
      {/* Items */}
      <div className="flex-1 overflow-hidden px-5 py-4 space-y-5">
        {Array.from({ length: 3 }).map((_, i) => (
          <CartItemSkeleton key={i} />
        ))}
      </div>
      {/* Footer */}
      <div className="border-t border-zinc-200 px-5 py-5 space-y-3 shrink-0">
        <div className="flex justify-between">
          <div className="animate-pulse rounded bg-zinc-200 h-4 w-20" />
          <div className="animate-pulse rounded bg-zinc-200 h-4 w-16" />
        </div>
        <div className="animate-pulse rounded bg-zinc-200 h-3 w-3/4 mx-auto" />
        <SkeletonButton className="rounded-xl h-12" />
        <SkeletonButton className="rounded-xl h-11 bg-zinc-100" />
      </div>
    </div>
  );
}

// Mirrors AuthFormCard + login/signup form layout
export function AuthFormSkeleton() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="absolute top-0 left-0 w-full flex h-16 items-center px-4 sm:px-8 bg-white border-b border-zinc-200">
        <div className="animate-pulse rounded-full bg-zinc-200 h-8 w-8" />
      </header>

      <div className="flex flex-1 flex-col items-center justify-center px-4 pt-24 pb-12 sm:px-8 sm:pt-32">
        <div className="w-full max-w-md">
          <div className="mx-auto w-full sm:rounded-2xl sm:border sm:border-zinc-200 bg-white px-2 py-8 sm:p-10">
            {/* Title + subtitle */}
            <div className="mb-8 flex flex-col gap-3">
              <div className="animate-pulse rounded bg-zinc-200 h-8 w-48" />
              <div className="animate-pulse rounded bg-zinc-200 h-3 w-64" />
            </div>

            {/* Fields */}
            <div className="flex flex-col gap-5">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-2">
                  <div className="animate-pulse rounded bg-zinc-200 h-3 w-20" />
                  <div className="animate-pulse rounded-lg bg-zinc-200 h-10 w-full" />
                </div>
              ))}
              <SkeletonButton className="mt-4 rounded-lg h-11" />
            </div>

            {/* Divider */}
            <div className="my-6 flex items-center gap-2">
              <div className="flex-1 animate-pulse bg-zinc-200 h-px" />
              <div className="animate-pulse rounded bg-zinc-200 h-3 w-6" />
              <div className="flex-1 animate-pulse bg-zinc-200 h-px" />
            </div>

            {/* OAuth */}
            <div className="flex gap-4">
              <div className="flex-1 animate-pulse rounded-lg bg-zinc-200 h-10" />
              <div className="flex-1 animate-pulse rounded-lg bg-zinc-200 h-10" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ADMIN SKELETONS
// ─────────────────────────────────────────────

// Shared: 5 table rows (image col + 3 text cols + actions col)
function AdminTableRowsSkeleton() {
  return (
    <div className="divide-y divide-zinc-100">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-6 py-4">
          <div className="animate-pulse rounded bg-zinc-200 h-4 flex-1" />
          <div className="animate-pulse rounded bg-zinc-200 h-4 w-24 hidden sm:block" />
          <div className="animate-pulse rounded bg-zinc-200 h-4 w-20 hidden sm:block" />
          <div className="animate-pulse rounded-full bg-zinc-200 h-5 w-16 hidden sm:block" />
          <div className="flex gap-1 ml-auto">
            <div className="animate-pulse rounded bg-zinc-200 h-7 w-7" />
            <div className="animate-pulse rounded bg-zinc-200 h-7 w-7 hidden sm:block" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Shared: 4 stat cards — mirrors grid used by Dashboard/Customers/Orders
function AdminStatCardsSkeleton({ cols = "lg:grid-cols-4" }) {
  return (
    <div className={`grid grid-cols-2 ${cols} gap-4 sm:gap-6 mb-8`}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-zinc-100 bg-white p-5 sm:p-6">
          <div className="animate-pulse rounded bg-zinc-200 h-3 w-24 mb-3" />
          <div className="flex items-end gap-2">
            <div className="animate-pulse rounded bg-zinc-200 h-7 w-20" />
            <div className="animate-pulse rounded bg-zinc-200 h-3 w-12 mb-0.5 hidden sm:block" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Mirrors AdminDashboard: header + 4 large stat cards + recent-products table
export function AdminDashboardSkeleton() {
  return (
    <>
      {/* Header */}
      <div className="flex flex-col items-start gap-4 mb-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="animate-pulse rounded bg-zinc-200 h-8 w-48" />
        <div className="flex gap-3">
          <div className="animate-pulse rounded-lg bg-zinc-200 h-9 w-32" />
          <div className="animate-pulse rounded-lg bg-zinc-200 h-9 w-36" />
        </div>
      </div>

      {/* Stat cards (1 col → 2 col → 4 col) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-zinc-100 bg-white p-6">
            <div className="animate-pulse rounded bg-zinc-200 h-3 w-24 mb-3" />
            <div className="flex items-end gap-2">
              <div className="animate-pulse rounded bg-zinc-200 h-8 w-24" />
              <div className="animate-pulse rounded bg-zinc-200 h-3 w-12 mb-1" />
            </div>
          </div>
        ))}
      </div>

      {/* Recent products table */}
      <div className="rounded-xl border border-zinc-100 bg-white">
        <div className="border-b border-zinc-100 px-6 py-4 flex items-center justify-between">
          <div className="animate-pulse rounded bg-zinc-200 h-5 w-36" />
          <div className="animate-pulse rounded bg-zinc-200 h-4 w-16" />
        </div>
        <AdminTableRowsSkeleton />
      </div>
    </>
  );
}

// Mirrors AdminProductsPage: header + card with tabs + search + table (no stats)
export function AdminProductsSkeleton() {
  return (
    <>
      {/* Header */}
      <div className="flex flex-col items-start gap-4 mb-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <div className="animate-pulse rounded bg-zinc-200 h-8 w-44" />
          <div className="animate-pulse rounded bg-zinc-200 h-3 w-56" />
        </div>
        <div className="animate-pulse rounded-lg bg-zinc-200 h-9 w-32" />
      </div>

      {/* Card */}
      <div className="rounded-xl border border-zinc-100 bg-white">
        {/* Tabs + search bar */}
        <div className="flex flex-col gap-4 border-b border-zinc-100 px-4 sm:px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-lg bg-zinc-200 h-8 w-16" />
            ))}
          </div>
          <div className="animate-pulse rounded-lg bg-zinc-200 h-9 w-full sm:w-56" />
        </div>
        <AdminTableRowsSkeleton />
      </div>
    </>
  );
}

// Mirrors AdminCustomersPage: header + 4 stat cards + table with search
export function AdminCustomersSkeleton() {
  return (
    <>
      {/* Header */}
      <div className="flex flex-col items-start gap-4 mb-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <div className="animate-pulse rounded bg-zinc-200 h-8 w-44" />
          <div className="animate-pulse rounded bg-zinc-200 h-3 w-56" />
        </div>
        <div className="animate-pulse rounded-lg bg-zinc-200 h-9 w-32" />
      </div>

      <AdminStatCardsSkeleton />

      {/* Card */}
      <div className="rounded-xl border border-zinc-100 bg-white">
        <div className="flex flex-col gap-4 border-b border-zinc-100 px-4 sm:px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="animate-pulse rounded bg-zinc-200 h-5 w-28" />
          <div className="animate-pulse rounded-lg bg-zinc-200 h-9 w-full sm:w-56" />
        </div>
        <AdminTableRowsSkeleton />
      </div>
    </>
  );
}

// Mirrors AdminOrdersPage: header + 4 stat cards + card with tabs + search + table
export function AdminOrdersSkeleton() {
  return (
    <>
      {/* Header */}
      <div className="flex flex-col items-start gap-4 mb-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <div className="animate-pulse rounded bg-zinc-200 h-8 w-44" />
          <div className="animate-pulse rounded bg-zinc-200 h-3 w-56" />
        </div>
        <div className="animate-pulse rounded-lg bg-zinc-200 h-9 w-28" />
      </div>

      <AdminStatCardsSkeleton />

      {/* Card */}
      <div className="rounded-xl border border-zinc-100 bg-white">
        {/* Tabs + search */}
        <div className="flex flex-col gap-4 border-b border-zinc-100 px-4 sm:px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-lg bg-zinc-200 h-8 w-20" />
            ))}
          </div>
          <div className="animate-pulse rounded-lg bg-zinc-200 h-9 w-full sm:w-56" />
        </div>
        <AdminTableRowsSkeleton />
      </div>
    </>
  );
}

// Mirrors AdminSettingsPage: header + 2-column (sidebar nav + content panel)
export function AdminSettingsSkeleton() {
  return (
    <>
      {/* Header */}
      <div className="flex flex-col items-start gap-4 mb-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <div className="animate-pulse rounded bg-zinc-200 h-8 w-44" />
          <div className="animate-pulse rounded bg-zinc-200 h-3 w-56" />
        </div>
        <div className="animate-pulse rounded-lg bg-zinc-200 h-9 w-28" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
        {/* Sidebar nav */}
        <div className="rounded-xl border border-zinc-100 bg-white p-2 h-max">
          <div className="flex lg:flex-col gap-1 overflow-x-auto">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-lg bg-zinc-200 h-9 w-full" />
            ))}
          </div>
        </div>

        {/* Content panel */}
        <div className="rounded-xl border border-zinc-100 bg-white p-6 space-y-6">
          <div className="animate-pulse rounded bg-zinc-200 h-6 w-36" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <div className="animate-pulse rounded bg-zinc-200 h-3 w-28" />
              <div className="animate-pulse rounded-lg bg-zinc-200 h-10 w-full" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
