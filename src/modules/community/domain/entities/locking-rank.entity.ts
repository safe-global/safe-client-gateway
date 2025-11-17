import type { LockingRankSchema } from '@/modules/community/domain/entities/schemas/locking-rank.schema';
import type { z } from 'zod';

export type LockingRank = z.infer<typeof LockingRankSchema>;
