import { JSONSchemaType } from 'ajv';
import { ERC20Transfer } from '../transfer.entity';

export const erc20TransferSchema: JSONSchemaType<ERC20Transfer> = {
  type: 'object',
  properties: {
    type: {
      type: 'string',
      const: 'ERC20_TRANSFER',
    },
    executionDate: { type: 'string' },
    blockNumber: { type: 'number' },
    transactionHash: { type: 'string' },
    to: { type: 'string' },
    from: { type: 'string' },
    value: { type: 'string' },
    tokenAddress: { type: 'string', nullable: true },
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
