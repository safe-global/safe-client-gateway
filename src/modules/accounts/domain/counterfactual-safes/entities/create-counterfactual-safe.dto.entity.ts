import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { z } from 'zod';
import type { Address } from 'viem';

export class CreateCounterfactualSafeDto implements z.infer<
  typeof CreateCounterfactualSafeDtoSchema
> {
  chainId: string;
  fallbackHandler: Address;
  owners: Array<Address>;
  predictedAddress: Address;
  saltNonce: string;
  singletonAddress: Address;
  threshold: number;

  constructor(props: CreateCounterfactualSafeDto) {
    this.chainId = props.chainId;
    this.fallbackHandler = props.fallbackHandler;
    this.owners = props.owners;
    this.predictedAddress = props.predictedAddress;
    this.saltNonce = props.saltNonce;
    this.singletonAddress = props.singletonAddress;
    this.threshold = props.threshold;
  }
}

export const CreateCounterfactualSafeDtoSchema = z.object({
  chainId: z.string(),
  fallbackHandler: AddressSchema,
  owners: z.array(AddressSchema).min(1),
  predictedAddress: AddressSchema,
  saltNonce: z.string(),
  singletonAddress: AddressSchema,
  threshold: z.number().int().gte(1),
});
