import { TransferSchema } from '@/domain/safe/entities/transfer.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';
import { z } from 'zod';

export type EthereumTransaction = z.infer<typeof EthereumTransactionSchema>;

export const EthereumTransactionSchema = z.object({
  executionDate: z.coerce.date(),
  data: HexSchema.nullish().default(null),
  txHash: HexSchema,
  blockNumber: z.number(),
  transfers: z.array(TransferSchema).nullish().default(null),
  from: AddressSchema,
});

export const EthereumTransactionTypeSchema = EthereumTransactionSchema.extend({
  txType: z.literal('ETHEREUM_TRANSACTION'),
});
