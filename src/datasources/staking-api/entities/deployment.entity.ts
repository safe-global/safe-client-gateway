import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { z } from 'zod';

export const DeploymentProductTypes = ['defi', 'pooling', 'dedicated'] as const;

export const DeploymentChains = [
  'eth',
  'arb',
  'bsc',
  'matic',
  'op',
  'base',
] as const;

export const DeploymentStatuses = [
  'active',
  'deposit_paused',
  'pending',
  'disabled',
] as const;

export const DeploymentExternalLinksSchema = z.object({
  deposit_url: z.string().url().nullish().default(null),
});

export const DeploymentSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  product_type: z.enum([...DeploymentProductTypes, 'unknown']).catch('unknown'),
  name: z.string(),
  display_name: z.string(),
  description: z.string(),
  chain: z.enum([...DeploymentChains, 'unknown']).catch('unknown'),
  chain_id: z.number(),
  address: AddressSchema,
  status: z.enum([...DeploymentStatuses, 'unknown']).catch('unknown'),
  external_links: DeploymentExternalLinksSchema.nullish().default(null),
});

export const DeploymentsSchema = z.array(DeploymentSchema);

export type Deployment = z.infer<typeof DeploymentSchema>;
