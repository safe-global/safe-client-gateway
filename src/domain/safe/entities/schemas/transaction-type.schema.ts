import { Schema } from 'ajv';
import { buildPageSchema } from '@/domain/entities/schemas/page.schema.factory';

export const TRANSACTION_TYPE_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/safe/transaction-type.json';

export const transactionTypeSchema: Schema = {
  $id: TRANSACTION_TYPE_SCHEMA_ID,
  type: 'object',
  discriminator: { propertyName: 'txType' },
  required: ['txType'],
  oneOf: [
    {
      $ref: 'ethereum-transaction-type.json',
    },
    {
      $ref: 'module-transaction-type.json',
    },
    {
      $ref: 'multisig-transaction-type.json',
    },
  ],
};

export const TRANSACTION_TYPE_PAGE_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/safe/transaction-type-page.json';

export const transactionTypePageSchema: Schema = buildPageSchema(
  TRANSACTION_TYPE_PAGE_SCHEMA_ID,
  transactionTypeSchema,
);
