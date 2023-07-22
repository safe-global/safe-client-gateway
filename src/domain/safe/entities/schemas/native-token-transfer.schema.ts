import { Schema } from 'ajv';

export const NATIVE_TOKEN_TRANSFER_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/safe/native-token-transfer.json';

export const nativeTokenTransferSchema: Schema = {
  $id: NATIVE_TOKEN_TRANSFER_SCHEMA_ID,
  type: 'object',
  properties: {
    type: { type: 'string', const: 'ETHER_TRANSFER' },
    executionDate: { type: 'string', isDate: true },
    blockNumber: { type: 'number' },
    transactionHash: { type: 'string' },
    to: { type: 'string' },
    from: { type: 'string' },
    value: { type: 'string' },
    transferId: { type: 'string' },
  },
  required: [
    'type',
    'executionDate',
    'blockNumber',
    'transactionHash',
    'to',
    'from',
    'value',
    'transferId',
  ],
};
