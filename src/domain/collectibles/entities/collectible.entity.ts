import { CollectibleSchema } from '@/domain/collectibles/entities/schemas/collectible.schema';
import { z } from 'zod';

export type Collectible = z.infer<typeof CollectibleSchema>;
