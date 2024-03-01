import { NativeCurrencySchema } from '@/domain/chains/entities/schemas/chain.schema';
import { z } from 'zod';

export type NativeCurrency = z.infer<typeof NativeCurrencySchema>;
