import { nativeTokenTransferSchema } from './native-token-transfer.schema';
import { Schema } from 'ajv';
import { erc20TransferSchema } from './erc20-transfer.schema';
import { erc721TransferSchema } from './erc721-transfer.schema';

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
  oneOf: [nativeTokenTransferSchema, erc20TransferSchema, erc721TransferSchema],
};
