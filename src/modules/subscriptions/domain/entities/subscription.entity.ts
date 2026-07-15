// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';
import { SpaceSchema } from '@/modules/spaces/domain/entities/space.entity';
import { SubscriptionMetadataSchema } from '@/modules/subscriptions/domain/entities/subscription-metadata.entity';

export type Subscription = z.infer<typeof SubscriptionSchema>;

export const SubscriptionStatuses = [
  'active',
  'past_due',
  'canceled',
  'paused',
] as const;

export const SubscriptionStatusSchema = z.enum(SubscriptionStatuses);

export type SubscriptionStatus = z.infer<typeof SubscriptionStatusSchema>;

// Keyed by billing-service subscription id, not RowSchema's numeric id.
export const SubscriptionSchema = z.object({
  id: z.string(),
  space: z.lazy((): z.ZodType<Space> => SpaceSchema).optional(),
  upstreamCustomerId: z.string(),
  status: SubscriptionStatusSchema,
  metadata: SubscriptionMetadataSchema,
  lastEventId: z.string(),
  lastEventOccurredAt: z.date(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
