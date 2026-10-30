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
