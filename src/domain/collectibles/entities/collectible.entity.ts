import type { CollectibleSchema } from '@/domain/collectibles/entities/schemas/collectible.schema';
import type { z } from 'zod';

export type Collectible = z.infer<typeof CollectibleSchema>;
