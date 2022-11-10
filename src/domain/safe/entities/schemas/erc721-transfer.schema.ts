import { JSONSchemaType } from 'ajv';
import { ERC721Transfer } from '../transfer.entity';

export const erc721TransferSchema: JSONSchemaType<ERC721Transfer> = {
  type: 'object',
  properties: {
    type: {
      type: 'string',
      const: 'ERC721_TRANSFER',
    },
    executionDate: { type: 'string' },
    blockNumber: { type: 'number' },
    transactionHash: { type: 'string' },
    to: { type: 'string' },
    from: { type: 'string' },
    tokenId: { type: 'string' },
    tokenAddress: { type: 'string', nullable: true },
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
