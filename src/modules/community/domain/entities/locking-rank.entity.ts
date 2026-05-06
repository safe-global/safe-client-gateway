// SPDX-License-Identifier: FSL-1.1-MIT
import type { z } from 'zod';
import type { LockingRankSchema } from '@/modules/community/domain/entities/schemas/locking-rank.schema';

export type LockingRank = z.infer<typeof LockingRankSchema>;
