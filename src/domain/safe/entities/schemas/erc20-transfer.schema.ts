import { Schema } from 'ajv';

export const erc20TransferSchema: Schema = {
  $id: 'https://safe-client.safe.global/schemas/safe/erc20-transfer.json',
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
