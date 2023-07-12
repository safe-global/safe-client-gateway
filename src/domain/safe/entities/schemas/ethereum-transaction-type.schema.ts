import { Schema } from 'ajv';

export const ETHEREUM_TRANSACTION_TYPE_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/safe/ethereum-transaction-type.json';

export const ethereumTransactionTypeSchema: Schema = {
  $id: ETHEREUM_TRANSACTION_TYPE_SCHEMA_ID,
  type: 'object',
  properties: {
    txType: { type: 'string', const: 'ETHEREUM_TRANSACTION' },
    executionDate: { type: 'string', isDate: true },
    data: { type: 'string', nullable: true, default: null },
    txHash: { type: 'string' },
    blockNumber: { type: 'number' },
    transfers: {
      type: 'array',
      items: {
        $ref: 'transfer.json',
      },
      nullable: true,
      default: null,
    },
    from: { type: 'string' },
  },
  required: ['txType', 'executionDate', 'txHash', 'blockNumber', 'from'],
};
