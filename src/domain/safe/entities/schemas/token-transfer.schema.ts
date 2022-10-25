import { JSONSchemaType } from 'ajv';
import { TokenTransfer } from '../transfer.entity';

export const tokenTransferSchema: JSONSchemaType<TokenTransfer> = {
  type: 'object',
  properties: {
    type: {
      type: 'string',
      enum: ['ERC721_TRANSFER', 'ERC20_TRANSFER'],
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
