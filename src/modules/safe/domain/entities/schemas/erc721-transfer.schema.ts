import { z } from 'zod';
import { TransferBaseSchema } from '@/modules/safe/domain/entities/schemas/transfer-base.schema';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

export const Erc721TransferSchema = TransferBaseSchema.extend({
  type: z.literal('ERC721_TRANSFER'),
  tokenId: z.string(),
  tokenAddress: AddressSchema,
});
