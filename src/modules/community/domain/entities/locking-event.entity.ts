// SPDX-License-Identifier: FSL-1.1-MIT
import type { z } from 'zod';
import type {
  LockEventItemSchema,
  LockingEventSchema,
  UnlockEventItemSchema,
  WithdrawEventItemSchema,
} from '@/modules/community/domain/entities/schemas/locking-event.schema';

export type LockEventItem = z.infer<typeof LockEventItemSchema>;

export type UnlockEventItem = z.infer<typeof UnlockEventItemSchema>;

export type WithdrawEventItem = z.infer<typeof WithdrawEventItemSchema>;

export type LockingEvent = z.infer<typeof LockingEventSchema>;
