import type { NativeCurrencySchema } from '@/domain/chains/entities/schemas/chain.schema';
import type { z } from 'zod';

export type NativeCurrency = z.infer<typeof NativeCurrencySchema>;
