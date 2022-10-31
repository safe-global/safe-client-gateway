import { JSONSchemaType } from 'ajv';
import { NativeTokenTransfer } from '../transfer.entity';

export const nativeTokenTransferSchema: JSONSchemaType<NativeTokenTransfer> = {
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
};
