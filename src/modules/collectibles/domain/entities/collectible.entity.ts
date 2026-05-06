// SPDX-License-Identifier: FSL-1.1-MIT
import type { z } from 'zod';
import type { CollectibleSchema } from '@/modules/collectibles/domain/entities/schemas/collectible.schema';

export type Collectible = z.infer<typeof CollectibleSchema>;
