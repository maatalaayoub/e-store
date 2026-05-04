import { z } from 'zod';

const translationEntry = z.object({
  name: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
});

export const productSchema = z.object({
  name: z.string().min(2).max(200),
  description: z.string().optional().nullable(),
  price: z.number().positive(),
  discount_price: z.number().nonnegative().optional().nullable(),
  discount_percentage: z.number().min(0).max(100).optional().nullable(),
  stock: z.number().int().nonnegative(),
  category_id: z.string().uuid().optional().nullable(),
  status: z.enum(['active', 'draft', 'archived']).default('draft'),
  is_featured: z.boolean().default(false),
  colors: z
    .array(z.object({ name: z.string().min(1), hex: z.string().min(1) }))
    .optional()
    .nullable(),
  sizes: z.array(z.string().min(1)).optional().nullable(),
  translations: z.record(z.string(), translationEntry).optional().nullable(),
});

export const productUpdateSchema = productSchema.partial();
