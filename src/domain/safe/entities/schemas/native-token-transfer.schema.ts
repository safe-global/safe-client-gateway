import { Schema } from 'ajv';

export const nativeTokenTransferSchema: Schema = {
  type: 'object',
  properties: {
    type: { type: 'string', const: 'ETHER_TRANSFER' },
    executionDate: { type: 'string', isDate: true },
    blockNumber: { type: 'number' },
    transactionHash: { type: 'string' },
    to: { type: 'string' },
    from: { type: 'string' },
    value: { type: 'string' },
  },
  required: [
    'type',
    'executionDate',
    'blockNumber',
    'transactionHash',
    'to',
    'from',
    'value',
  ],
};
