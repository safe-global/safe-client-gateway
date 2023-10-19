import { Schema } from 'ajv';
import { buildPageSchema } from '@/domain/entities/schemas/page.schema.factory';

export const MODULE_TRANSACTION_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/safe/module-transaction.json';

export const moduleTransactionSchema: Schema = {
  $id: MODULE_TRANSACTION_SCHEMA_ID,
  type: 'object',
  properties: {
    safe: { type: 'string' },
    to: { type: 'string' },
    value: { type: 'string', nullable: true, default: null },
    data: { type: 'string', nullable: true, default: null },
    dataDecoded: {
      oneOf: [
        {
          $ref: '../data-decoded/data-decoded.json',
        },
        { type: 'null' },
      ],
    },
    operation: { type: 'number', enum: [0, 1] },
    created: { type: 'string', isDate: true },
    executionDate: { type: 'string', isDate: true },
    blockNumber: { type: 'number' },
    isSuccessful: { type: 'boolean' },
    transactionHash: { type: 'string' },
    module: { type: 'string' },
    moduleTransactionId: { type: 'string' },
  },
  required: [
    'safe',
    'to',
    'operation',
    'created',
    'executionDate',
    'blockNumber',
    'isSuccessful',
    'transactionHash',
    'module',
    'moduleTransactionId',
  ],
};

export const MODULE_TRANSACTION_PAGE_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/safe/module-transaction-page.json';

export const moduleTransactionPageSchema: Schema = buildPageSchema(
  MODULE_TRANSACTION_PAGE_SCHEMA_ID,
  moduleTransactionSchema,
);
