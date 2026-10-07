// SPDX-License-Identifier: FSL-1.1-MIT
import type { z } from 'zod';
import type { RelayerSchema } from '@/modules/chains/domain/entities/schemas/chain.schema';

export type Relayer = z.infer<typeof RelayerSchema>;
