import type { CollectibleSchema } from '@/modules/collectibles/domain/entities/schemas/collectible.schema';
import type { z } from 'zod';

export type Collectible = z.infer<typeof CollectibleSchema>;
