import { Schema } from 'ajv';
import { buildPageSchema } from '../../../entities/schemas/page.schema.factory';

export const moduleTransactionSchema: Schema = {
  $id: 'https://safe-client.safe.global/schemas/safe/module-transaction.json',
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

export const moduleTransactionPageSchema: Schema = buildPageSchema(
  'https://safe-client.safe.global/schemas/safe/module-transaction-page.json',
  moduleTransactionSchema,
);
