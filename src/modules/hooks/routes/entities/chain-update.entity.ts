// SPDX-License-Identifier: FSL-1.1-MIT
import type { z } from 'zod';
import type { ChainUpdateEventSchema } from '@/modules/hooks/routes/entities/schemas/chain-update.schema';

export type ChainUpdate = z.infer<typeof ChainUpdateEventSchema>;
