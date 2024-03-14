import { OrderSchema } from '@/domain/swaps/entities/schemas/order.schema';
import { z } from 'zod';

export type Order = z.infer<typeof OrderSchema>;
