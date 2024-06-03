import {
  LockEventItemSchema,
  LockingEventSchema,
  UnlockEventItemSchema,
  WithdrawEventItemSchema,
} from '@/domain/community/entities/schemas/locking-event.schema';
import { z } from 'zod';

export type LockEventItem = z.infer<typeof LockEventItemSchema>;

export type UnlockEventItem = z.infer<typeof UnlockEventItemSchema>;

export type WithdrawEventItem = z.infer<typeof WithdrawEventItemSchema>;

export type LockingEvent = z.infer<typeof LockingEventSchema>;
