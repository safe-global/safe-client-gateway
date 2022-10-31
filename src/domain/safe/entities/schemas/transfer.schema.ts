import { nativeTokenTransferSchema } from './native-token-transfer.schema';
import { tokenTransferSchema } from './token-transfer.schema';
import { Schema } from 'ajv';

export const transferSchema: Schema = {
  type: 'object',
  discriminator: { propertyName: 'type' },
  required: [
    'type',
    'executionDate',
    'blockNumber',
    'transactionHash',
    'to',
    'from',
  ],
  oneOf: [nativeTokenTransferSchema, tokenTransferSchema],
};
