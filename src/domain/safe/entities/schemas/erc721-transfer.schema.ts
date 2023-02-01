import { Schema } from 'ajv';

export const erc721TransferSchema: Schema = {
  $id: 'https://safe-client.safe.global/schemas/safe/erc721-transfer.json',
  type: 'object',
  properties: {
    type: {
      type: 'string',
      const: 'ERC721_TRANSFER',
    },
    executionDate: { type: 'string', isDate: true },
    blockNumber: { type: 'number' },
    transactionHash: { type: 'string' },
    to: { type: 'string' },
    from: { type: 'string' },
    tokenId: { type: 'string' },
    tokenAddress: { type: 'string', nullable: true, default: null },
  },
  required: [
    'type',
    'executionDate',
    'blockNumber',
    'transactionHash',
    'to',
    'from',
    'tokenId',
  ],
};
