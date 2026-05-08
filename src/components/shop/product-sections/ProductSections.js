/**
 * <ProductSections> — top-level dynamic renderer used by the product page.
 *
 * Server Component. Resolves the effective sections array from product +
 * global defaults, then renders each one through the component registry.
 */

import { productSectionService } from '@/modules/product-sections/service';
import { getSectionComponent } from './registry';

const PADDING_CLASS = {
  none: '',
  sm: 'py-4',
  md: 'py-8',
  lg: 'py-12',
};

const WIDTH_CLASS = {
  container: 'mx-auto max-w-3xl px-4 sm:px-6 lg:px-8',
  wide: 'mx-auto max-w-7xl px-4 sm:px-6 lg:px-8',
  full: 'w-full px-4 sm:px-6 lg:px-8',
};

const BACKGROUND_CLASS = {
  transparent: '',
  muted: 'bg-zinc-50',
  accent: 'bg-blue-50',
};

export function sectionWrapperStyle(section) {
  const cfg = section.config ?? {};
  const padding = PADDING_CLASS[cfg.padding] ?? PADDING_CLASS.md;
  const width = WIDTH_CLASS[cfg.width] ?? WIDTH_CLASS.container;
  const bg = cfg.background === 'custom' ? '' : (BACKGROUND_CLASS[cfg.background] ?? '');
  const inlineStyle = {};
  if (cfg.background === 'custom' && cfg.background_color) inlineStyle.backgroundColor = cfg.background_color;
  if (cfg.title_color) inlineStyle['--section-title-color'] = cfg.title_color;
  const bw = Number(cfg.border_width) || 0;
  if (bw > 0 && cfg.border_color) {
    inlineStyle.border = `${bw}px solid ${cfg.border_color}`;
    inlineStyle.borderRadius = '0.5rem';
    inlineStyle.overflow = 'hidden';
  }
  return { wrapperClass: `${bg} ${padding}`.trim(), innerClass: width, style: inlineStyle };
}

export default async function ProductSections({ product, locale, dict, excludeTypes = [] }) {
  if (!product) return null;

  const globalDefaults = await productSectionService.getGlobalDefaults();
  const allSections = productSectionService.resolveForProduct(product, globalDefaults, locale);
  const sections = excludeTypes.length > 0
    ? allSections.filter((s) => !excludeTypes.includes(s.type))
    : allSections;

  if (sections.length === 0) return null;

  return (
    <div className="mt-12">
      {sections.map((section) => {
        const Cmp = getSectionComponent(section.type);
        if (!Cmp) return null;
        const { wrapperClass, innerClass, style } = sectionWrapperStyle(section);
        return (
          <section
            key={section.id ?? section.type}
            data-section-type={section.type}
            className={wrapperClass}
            style={Object.keys(style).length ? style : undefined}
          >
            <div className={innerClass}>
              {/* @ts-expect-error — Cmp may be an async Server Component (RelatedProducts). */}
              <Cmp section={section} product={product} locale={locale} dict={dict} />
            </div>
          </section>
        );
      })}
    </div>
  );
}
