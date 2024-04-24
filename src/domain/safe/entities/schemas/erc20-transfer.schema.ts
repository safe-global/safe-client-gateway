import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';

export const Erc20TransferSchema = z.object({
  type: z.literal('ERC20_TRANSFER'),
  executionDate: z.coerce.date(),
  blockNumber: z.number(),
  transactionHash: HexSchema,
  to: AddressSchema,
  from: AddressSchema,
  value: z.string(),
  tokenAddress: AddressSchema,
  transferId: z.string(),
});
