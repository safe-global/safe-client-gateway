import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { z } from 'zod';

export const DeploymentSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  product_type: z
    .enum(['defi', 'pooling', 'dedicated', 'unknown'])
    .catch('unknown'),
  name: z.string(),
  display_name: z.string(),
  description: z.string(),
  // TODO: Confirm all potential values
  chain: z.enum(['eth', 'bsc', 'unknown']).catch('unknown'),
  chain_id: z.number(),
  address: AddressSchema,
  // TODO: Confirm all potential values
  status: z.enum(['active', 'unknown']).catch('unknown'),
  product_fee: z.string().nullish().default(null),
});

export type Deployment = z.infer<typeof DeploymentSchema>;
