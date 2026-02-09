import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { TransferBaseSchema } from '@/modules/safe/domain/entities/schemas/transfer-base.schema';

export const Erc20TransferSchema = TransferBaseSchema.extend({
  type: z.literal('ERC20_TRANSFER'),
  value: z.string(),
  tokenAddress: AddressSchema,
});
