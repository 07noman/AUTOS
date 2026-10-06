import { z } from 'zod';

export const orderSchema = z.object({
  paymentMethod: z.enum(['cash', 'card', 'mobile', 'credit']),
  discount: z.coerce.number().min(0).default(0),
  notes: z.string().optional(),
});
