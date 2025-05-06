import { z } from 'zod';

export const OrderTypeSchema = z.enum(['FASTEST', 'CHEAPEST']);

export type OrderType = z.infer<typeof OrderTypeSchema>;
