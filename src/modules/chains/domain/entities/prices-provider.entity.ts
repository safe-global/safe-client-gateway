// SPDX-License-Identifier: FSL-1.1-MIT
import type { z } from 'zod';
import type { PricesProviderSchema } from '@/modules/chains/domain/entities/schemas/chain.schema';

export type PricesProvider = z.infer<typeof PricesProviderSchema>;
