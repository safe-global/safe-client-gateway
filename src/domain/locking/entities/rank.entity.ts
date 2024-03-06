import { RankSchema } from '@/domain/locking/entities/schemas/rank.schema';
import { z } from 'zod';

export type Rank = z.infer<typeof RankSchema>;
