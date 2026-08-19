// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { SubscriptionStatusSchema } from '@/datasources/billing-api/entities/subscription.entity';
import { RowSchema } from '@/datasources/db/v2/entities/row.entity';
import { SubscriptionEntitlementSchema } from '@/modules/entitlements/domain/entities/subscription-entitlement.entity';

export type SpaceSubscription = z.infer<typeof SpaceSubscriptionSchema>;

export const SpaceSubscriptionSchema = RowSchema.extend({
  upstreamSubscriptionId: z.string(),
  status: SubscriptionStatusSchema,
  planId: z.string(),
  planName: z.string().nullable(),
  currentPeriodStart: z.date().nullable(),
  currentPeriodEnd: z.date().nullable(),
  lastEventAt: z.date().nullable(),
  entitlements: z.array(SubscriptionEntitlementSchema).optional(),
});

/** The columns a sync writes: everything but the row's own identity. */
export type SubscriptionValues = Pick<
  SpaceSubscription,
  | 'status'
  | 'planId'
  | 'planName'
  | 'currentPeriodStart'
  | 'currentPeriodEnd'
  | 'lastEventAt'
>;
