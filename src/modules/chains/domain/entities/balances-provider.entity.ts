// SPDX-License-Identifier: FSL-1.1-MIT
import type { z } from 'zod';
import type { BalancesProviderSchema } from '@/modules/chains/domain/entities/schemas/chain.schema';

export type BalancesProvider = z.infer<typeof BalancesProviderSchema>;
