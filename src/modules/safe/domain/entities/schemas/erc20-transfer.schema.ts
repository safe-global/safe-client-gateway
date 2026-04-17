import { z } from 'zod';
import { TransferBaseSchema } from '@/modules/safe/domain/entities/schemas/transfer-base.schema';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

export const Erc20TransferSchema = TransferBaseSchema.extend({
  type: z.literal('ERC20_TRANSFER'),
  value: z.string(),
  tokenAddress: AddressSchema,
});
