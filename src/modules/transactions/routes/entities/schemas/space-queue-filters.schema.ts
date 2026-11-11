// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { SAFE_QUEUE_SERVICE_MAX_LIMIT } from '#/domain/common/constants';

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

/** At most one queue service page */
export const SPACE_QUEUE_LIMIT_MAX = SAFE_QUEUE_SERVICE_MAX_LIMIT;

export const SpaceQueueLimitSchema = z
  .string()
  .regex(/^\d+$/)
  .transform(Number)
  .pipe(z.number().int().min(1).max(SPACE_QUEUE_LIMIT_MAX));
