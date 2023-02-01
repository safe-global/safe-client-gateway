import { Schema } from 'ajv';

export const moduleTransactionTypeSchema: Schema = {
  $id: 'https://safe-client.safe.global/schemas/safe/module-transaction-type.json',
  type: 'object',
  properties: {
    txType: { type: 'string', const: 'MODULE_TRANSACTION' },
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
    created: { type: 'string' },
    executionDate: { type: 'string', isDate: true },
    blockNumber: { type: 'number' },
    isSuccessful: { type: 'boolean' },
    transactionHash: { type: 'string' },
    module: { type: 'string' },
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
  ],
};
