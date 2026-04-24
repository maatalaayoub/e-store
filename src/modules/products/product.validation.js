import { z } from 'zod';

export const productSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().min(10),
  price: z.number().positive(),
  stock: z.number().int().nonnegative(),
  category_id: z.string().uuid().optional(),
});
