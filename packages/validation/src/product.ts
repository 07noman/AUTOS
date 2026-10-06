import { z } from 'zod';

export const productSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(3),
  barcode: z.string().optional(),
  categoryId: z.string().optional(),
  costPrice: z.coerce.number().min(0),
  sellingPrice: z.coerce.number().min(0),
  wholesalePrice: z.coerce.number().min(0).optional(),
  stock: z.coerce.number().min(0).default(0),
  minimumStock: z.coerce.number().min(0).default(0),
  status: z.enum(['active', 'inactive', 'archived']).default('active'),
});
