import { Schema } from 'ajv';

export const transferSchema: Schema = {
  $id: 'https://safe-client.safe.global/schemas/safe/transfer.json',
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
  oneOf: [
    {
      $ref: 'native-token-transfer.json',
    },
    {
      $ref: 'erc20-transfer.json',
    },
    {
      $ref: 'erc721-transfer.json',
    },
  ],
};
