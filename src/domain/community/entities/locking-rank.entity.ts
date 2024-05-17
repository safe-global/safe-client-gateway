import { LockingRankSchema } from '@/domain/community/entities/schemas/locking-rank.schema';
import { z } from 'zod';

export type LockingRank = z.infer<typeof LockingRankSchema>;
