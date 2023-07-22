import { Schema } from 'ajv';

export const ERC20_TRANSFER_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/safe/erc20-transfer.json';

export const erc20TransferSchema: Schema = {
  $id: ERC20_TRANSFER_SCHEMA_ID,
  type: 'object',
  properties: {
    type: {
      type: 'string',
      const: 'ERC20_TRANSFER',
    },
    executionDate: { type: 'string', isDate: true },
    blockNumber: { type: 'number' },
    transactionHash: { type: 'string' },
    to: { type: 'string' },
    from: { type: 'string' },
    value: { type: 'string' },
    tokenAddress: { type: 'string', nullable: true, default: null },
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
