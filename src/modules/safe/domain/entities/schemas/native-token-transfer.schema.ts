import { z } from 'zod';
import { TransferBaseSchema } from '@/modules/safe/domain/entities/schemas/transfer-base.schema';

export const NativeTokenTransferSchema = TransferBaseSchema.extend({
  type: z.literal('ETHER_TRANSFER'),
  value: z.string(),
});
