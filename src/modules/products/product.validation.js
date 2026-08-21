import { z } from 'zod';

const translationEntry = z.object({
  name: z.string().optional().nullable(),
  short_description: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
});

const seoLocaleEntry = z
  .object({
    title: z.string().optional().nullable(),
    description: z.string().optional().nullable(),
    keywords: z.string().optional().nullable(),
    og_title: z.string().optional().nullable(),
    og_description: z.string().optional().nullable(),
  })
  .partial();

// Permissive shape — sanitized/clamped server-side in src/lib/seo/sanitize.js.
const seoSchema = z
  .object({
    title: z.string().optional().nullable(),
    description: z.string().optional().nullable(),
    keywords: z.string().optional().nullable(),
    canonical_url: z.string().optional().nullable(),
    og_title: z.string().optional().nullable(),
    og_description: z.string().optional().nullable(),
    og_image: z.string().optional().nullable(),
    no_index: z.boolean().optional().nullable(),
    no_follow: z.boolean().optional().nullable(),
    translations: z.record(z.string(), seoLocaleEntry).optional().nullable(),
  })
  .partial();


export const productSchema = z.object({
  name: z.string().min(2).max(200),
  short_description: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  price: z.number().positive(),
  discount_price: z.number().nonnegative().optional().nullable(),
  discount_percentage: z.number().min(0).max(100).optional().nullable(),
  stock: z.number().int().nonnegative(),
  category_id: z.string().uuid().optional().nullable(),
  status: z.enum(['active', 'draft', 'archived']).default('draft'),
  is_featured: z.boolean().default(false),
  // Dynamic product wizard: the selected product-type config id. Kept
  // permissive (validated against the registry server-side) and optional so
  // legacy products without a type still pass.
  product_type: z.string().max(50).optional().nullable(),
  // Type-specific structured attributes; sanitized against the type schema
  // server-side, so a permissive shape here is enough.
  attributes: z.record(z.string(), z.any()).optional().nullable(),
  // RAM/Storage/combination variants; sanitized server-side (structure,
  // numeric clamps, availability), so a permissive shape is enough here.
  variants: z.any().optional().nullable(),
  colors: z
    .array(z.object({ name: z.string().min(1), hex: z.string().min(1) }))
    .optional()
    .nullable(),
  sizes: z.array(z.string().min(1)).optional().nullable(),
  translations: z.record(z.string(), translationEntry).optional().nullable(),
  // SEO — human-friendly slug + manual overrides (sanitized server-side).
  slug: z.string().max(120).optional().nullable(),
  seo: seoSchema.optional().nullable(),
  // Dynamic Product Sections — see src/modules/product-sections.
  // The sections array is sanitized server-side before persisting; here we
  // only need a permissive shape so legitimate payloads pass validation.
  use_default_sections: z.boolean().optional(),
  sections_config: z.array(z.any()).optional().nullable(),
});

export const productUpdateSchema = productSchema.partial();
