// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { SubscriptionStatusSchema } from '@/datasources/billing-api/entities/subscription.entity';
import { RowSchema } from '@/datasources/db/v2/entities/row.entity';
import type { SubscriptionEntitlement } from '@/modules/entitlements/domain/entities/subscription-entitlement.entity';
import { SubscriptionEntitlementSchema } from '@/modules/entitlements/domain/entities/subscription-entitlement.entity';

export type SpaceSubscription = z.infer<typeof SpaceSubscriptionSchema>;

export const SpaceSubscriptionSchema = RowSchema.extend({
  upstreamSubscriptionId: z.string(),
  status: SubscriptionStatusSchema,
  planId: z.string(),
  planName: z.string().nullable(),
  currentPeriodStart: z.date().nullable(),
  currentPeriodEnd: z.date().nullable(),
  entitlements: z
    .array(
      z.lazy(
        (): z.ZodType<SubscriptionEntitlement> => SubscriptionEntitlementSchema,
      ),
    )
    .optional(),
});
