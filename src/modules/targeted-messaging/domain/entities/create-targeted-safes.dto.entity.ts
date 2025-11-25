import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { z } from 'zod';
import type { Address } from 'viem';

// Entry can be either:
// 1. Simple address string (legacy, creates with chain_id = NULL)
// 2. Object with address and chainId (new format for chain-specific targeting)
const TargetedSafeEntrySchema = z.union([
  AddressSchema,
  z.object({
    address: AddressSchema,
    chainId: z.string(),
  }),
]);

export const CreateTargetedSafesDtoSchema = z.object({
  outreachId: z.number(),
  addresses: z.array(TargetedSafeEntrySchema),
});

export type TargetedSafeEntry = Address | { address: Address; chainId: string };

export class CreateTargetedSafesDto
  implements z.infer<typeof CreateTargetedSafesDtoSchema>
{
  outreachId: number;
  addresses: Array<TargetedSafeEntry>;

  constructor(props: CreateTargetedSafesDto) {
    this.outreachId = props.outreachId;
    this.addresses = props.addresses;
  }
}
