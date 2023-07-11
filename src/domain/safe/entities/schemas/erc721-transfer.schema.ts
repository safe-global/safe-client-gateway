import { Schema } from 'ajv';

export const ERC721_TRANSFER_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/safe/erc721-transfer.json';

export const erc721TransferSchema: Schema = {
  $id: ERC721_TRANSFER_SCHEMA_ID,
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
    transferId: { type: 'string' },
  },
  required: [
    'type',
    'executionDate',
    'blockNumber',
    'transactionHash',
    'to',
    'from',
    'tokenId',
    'transferId',
  ],
};
