import { Schema } from 'ajv';
import { buildPageSchema } from '@/domain/entities/schemas/page.schema.factory';
import { z } from 'zod';
import { buildZodPageSchema } from '@/domain/entities/schemas/page.schema.factory';
import { NativeTokenTransferSchema } from '@/domain/safe/entities/schemas/native-token-transfer.schema';
import { Erc20TransferSchema } from '@/domain/safe/entities/schemas/erc20-transfer.schema';
import { Erc721TransferSchema } from '@/domain/safe/entities/schemas/erc721-transfer.schema';

export const TransferSchema = z.discriminatedUnion('type', [
  NativeTokenTransferSchema,
  Erc20TransferSchema,
  Erc721TransferSchema,
]);

export const TransferPageSchema = buildZodPageSchema(TransferSchema);

// TODO: Remove after migrating transactionTypeSchema
export const TRANSFER_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/safe/transfer.json';

export const transferSchema: Schema = {
  $id: TRANSFER_SCHEMA_ID,
  type: 'object',
  discriminator: { propertyName: 'type' },
  required: [
    'type',
    'executionDate',
    'blockNumber',
    'transactionHash',
    'to',
    'from',
  ],
  oneOf: [
    {
      $ref: 'native-token-transfer.json',
    },
    {
      $ref: 'erc20-transfer.json',
    },
    {
      $ref: 'erc721-transfer.json',
    },
  ],
};

export const TRANSFER_PAGE_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/safe/transfer-page.json';

export const transferPageSchema: Schema = buildPageSchema(
  TRANSFER_PAGE_SCHEMA_ID,
  transferSchema,
);
