import { JSONSchemaType } from 'ajv';
import { NativeTokenTransfer, TokenTransfer } from '../transfer.entity';

export const transferSchema: JSONSchemaType<
  TokenTransfer | NativeTokenTransfer
> = {
  type: 'object',
  required: [],
  oneOf: [
    {
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
    },
    {
      type: 'object',
      properties: {
        type: { type: 'string', const: 'ETHER_TRANSFER' },
        executionDate: { type: 'string' },
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
    },
  ],
};
