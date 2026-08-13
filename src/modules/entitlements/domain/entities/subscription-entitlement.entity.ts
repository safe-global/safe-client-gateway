// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { RowSchema } from '@/datasources/db/v2/entities/row.entity';
import { FeatureSchema } from '@/modules/entitlements/domain/entities/feature.entity';

export type SubscriptionEntitlement = z.infer<
  typeof SubscriptionEntitlementSchema
>;

export const SubscriptionEntitlementSchema = RowSchema.extend({
  enabled: z.boolean(),
  quota: z.number().int().nullable(),
  value: z.string().nullable(),
  feature: FeatureSchema,
});
