import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';

export const Erc721TransferSchema = z.object({
  type: z.literal('ERC721_TRANSFER'),
  executionDate: z.coerce.date(),
  blockNumber: z.number(),
  transactionHash: HexSchema,
  to: AddressSchema,
  from: AddressSchema,
  tokenId: z.string(),
  tokenAddress: AddressSchema,
  transferId: z.string(),
});
