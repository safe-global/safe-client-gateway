import { buildPageSchema } from '@/domain/entities/schemas/page.schema.factory';
import { Erc20TransferSchema } from '@/domain/safe/entities/schemas/erc20-transfer.schema';
import { Erc721TransferSchema } from '@/domain/safe/entities/schemas/erc721-transfer.schema';
import { NativeTokenTransferSchema } from '@/domain/safe/entities/schemas/native-token-transfer.schema';
import { z } from 'zod';

export type Transfer = z.infer<typeof TransferSchema>;

export const TransferSchema = z.discriminatedUnion('type', [
  NativeTokenTransferSchema,
  Erc20TransferSchema,
  Erc721TransferSchema,
]);

export const TransferPageSchema = buildPageSchema(TransferSchema);

export type ERC20Transfer = z.infer<typeof Erc20TransferSchema>;

export type ERC721Transfer = z.infer<typeof Erc721TransferSchema>;

export type NativeTokenTransfer = z.infer<typeof NativeTokenTransferSchema>;
