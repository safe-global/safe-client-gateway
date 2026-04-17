// SPDX-License-Identifier: FSL-1.1-MIT
import type { z } from 'zod';
import type { NativeCurrencySchema } from '@/modules/chains/domain/entities/schemas/chain.schema';

export type NativeCurrency = z.infer<typeof NativeCurrencySchema>;
