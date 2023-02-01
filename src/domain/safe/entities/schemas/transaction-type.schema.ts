import { Schema } from 'ajv';

export const transactionTypeSchema: Schema = {
  $id: 'https://safe-client.safe.global/schemas/safe/transaction-type.json',
  type: 'object',
  discriminator: { propertyName: 'txType' },
  required: ['txType'],
  oneOf: [
    {
      $ref: 'ethereum-transaction-type.json',
    },
    {
      $ref: 'module-transaction-type.json',
    },
    {
      $ref: 'multisig-transaction-type.json',
    },
  ],
};
