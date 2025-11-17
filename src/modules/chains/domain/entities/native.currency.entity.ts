import type { NativeCurrencySchema } from '@/modules/chains/domain/entities/schemas/chain.schema';
import type { z } from 'zod';

export type NativeCurrency = z.infer<typeof NativeCurrencySchema>;
