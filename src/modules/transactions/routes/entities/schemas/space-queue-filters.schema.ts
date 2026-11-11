// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';

export const SpaceQueueStatus = {
  Execute: 'execute',
  Sign: 'sign',
  Blocked: 'blocked',
  Waiting: 'waiting',
} as const;

export const SpaceQueueStatusSchema = z.enum(SpaceQueueStatus);

export type SpaceQueueStatus = z.infer<typeof SpaceQueueStatusSchema>;

export const SpaceQueueStatusesSchema = z
  .string()
  .transform((value) => value.split(','))
  .pipe(z.array(SpaceQueueStatusSchema).nonempty());

export type SpaceQueueStatuses = z.infer<typeof SpaceQueueStatusesSchema>;

export const SPACE_QUEUE_SEARCH_MAX_LENGTH = 100;

/** Trimmed and lowercased; blank reads as no search */
export const SpaceQueueSearchSchema = z
  .string()
  .trim()
  .max(SPACE_QUEUE_SEARCH_MAX_LENGTH)
  .transform((value) => value.toLowerCase() || undefined);
