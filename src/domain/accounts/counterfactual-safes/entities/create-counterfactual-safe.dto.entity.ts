import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { z } from 'zod';

export class CreateCounterfactualSafeDto
  implements z.infer<typeof CreateCounterfactualSafeDtoSchema>
{
  chain_id: string;
  fallback_handler: `0x${string}`;
  owners: `0x${string}`[];
  predicted_address: `0x${string}`;
  salt_nonce: string;
  singleton_address: `0x${string}`;
  threshold: number;

  constructor(props: CreateCounterfactualSafeDto) {
    this.chain_id = props.chain_id;
    this.fallback_handler = props.fallback_handler;
    this.owners = props.owners;
    this.predicted_address = props.predicted_address;
    this.salt_nonce = props.salt_nonce;
    this.singleton_address = props.singleton_address;
    this.threshold = props.threshold;
  }
}

export const CreateCounterfactualSafeDtoSchema = z.object({
  chain_id: z.string(),
  fallback_handler: AddressSchema,
  owners: z.array(AddressSchema).min(1),
  predicted_address: AddressSchema,
  salt_nonce: z.string(),
  singleton_address: AddressSchema,
  threshold: z.number().int().gte(1),
});
