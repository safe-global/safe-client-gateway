import { Schema } from 'ajv';
import { dataDecodedSchema } from '../../../data-decoder/entities/schemas/data-decoded.schema';

export const moduleTransactionTypeSchema: Schema = {
  type: 'object',
  properties: {
    txType: { type: 'string', const: 'MODULE_TRANSACTION' },
    safe: { type: 'string' },
    to: { type: 'string' },
    value: { type: 'string', nullable: true },
    data: { type: 'string', nullable: true },
    dataDecoded: dataDecodedSchema,
    operation: { type: 'number', enum: [0, 1] },
    created: { type: 'string' },
    executionDate: { type: 'string', isDate: true },
    blockNumber: { type: 'string' },
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
