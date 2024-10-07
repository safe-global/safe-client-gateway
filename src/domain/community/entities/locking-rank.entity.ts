import type { LockingRankSchema } from '@/domain/community/entities/schemas/locking-rank.schema';
import type { z } from 'zod';

export type LockingRank = z.infer<typeof LockingRankSchema>;
