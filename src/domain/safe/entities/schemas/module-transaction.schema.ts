import { Schema } from 'ajv';
import { dataDecodedSchema } from '../../../data-decoder/entities/schemas/data-decoded.schema';

export const moduleTransactionSchema: Schema = {
  type: 'object',
  properties: {
    safe: { type: 'string' },
    to: { type: 'string' },
    value: { type: 'string', nullable: true, default: null },
    data: { type: 'string', nullable: true, default: null },
    dataDecoded: dataDecodedSchema,
    operation: { type: 'number', enum: [0, 1] },
    created: { type: 'string', isDate: true },
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
