import { Schema } from 'ajv';
import { buildPageSchema } from '../../../entities/schemas/page.schema.factory';

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
