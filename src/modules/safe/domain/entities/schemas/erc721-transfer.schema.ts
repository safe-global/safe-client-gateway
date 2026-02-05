import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { TransferBaseSchema } from '@/modules/safe/domain/entities/schemas/transfer-base.schema';

export const Erc721TransferSchema = TransferBaseSchema.extend({
  type: z.literal('ERC721_TRANSFER'),
  tokenId: z.string(),
  tokenAddress: AddressSchema,
});
