// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { RowSchema } from '#/datasources/db/v2/entities/row.entity';
import { PolicyConfigurationsSchema } from '#/modules/policies/domain/entities/policy-configuration.entity';
import { SafeRefSchema } from '#/modules/policies/domain/entities/safe-ref.entity';
import { HexSchema } from '#/validation/entities/schemas/hex.schema';
import { UuidSchema } from '#/validation/entities/schemas/uuid.schema';

/**
 * The `Configuration[]` behind a delayed configuration root, stored per Space
 * and Safe. Rows are immutable, hence no `updatedAt`.
 */
export const PolicyConfigurationRequestSchema = RowSchema.omit({
  updatedAt: true,
}).extend({
  id: UuidSchema,
  spaceId: z.number().int(),
  chainId: SafeRefSchema.shape.chainId,
  safeAddress: SafeRefSchema.shape.address,
  root: HexSchema,
  configurations: PolicyConfigurationsSchema,
  createdBy: z.number().int(),
});

export type PolicyConfigurationRequest = z.infer<
  typeof PolicyConfigurationRequestSchema
>;
