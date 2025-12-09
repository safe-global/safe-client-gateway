import { z } from 'zod';
import { BalanceChangesSchema } from '@/modules/safe-shield/entities/threat-analysis.types';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

const ValidationFeatureSchema = z.object({
  type: z.string(),
  description: z.string(),
  address: AddressSchema.optional(),
});

const ValidationSchema = z.object({
  result_type: z.string(),
  reason: z.string().optional(),
  classification: z.string().optional(),
  description: z.string().optional(),
  error: z.string().optional(),
  features: z.array(ValidationFeatureSchema),
});

const ContractManagementChangeSchema = z.object({
  type: z.string(),
  before: z
    .object({
      address: AddressSchema,
    })
    .optional(),
  after: z
    .object({
      address: AddressSchema,
    })
    .optional(),
});

const SimulationSchema = z.object({
  status: z.string(),
  description: z.string().optional(),
  error: z.string().optional(),
  assets_diffs: z.record(BalanceChangesSchema).optional(),
  contract_management: z
    .record(z.array(ContractManagementChangeSchema))
    .optional(),
});

export const BlockaidScanResponseSchema = z.object({
  request_id: z.union([z.string(), z.undefined()]),
  validation: ValidationSchema.optional(),
  simulation: SimulationSchema.optional(),
});

export type TransactionValidation = z.infer<typeof ValidationSchema>;
export type TransactionSimulation = z.infer<typeof SimulationSchema>;
export type BlockaidScanResponse = z.infer<typeof BlockaidScanResponseSchema>;
