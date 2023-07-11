import { Schema } from 'ajv';

export const CREATION_TRANSACTION_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/safe/creation-transaction.json';

export const creationTransactionSchema: Schema = {
  $id: CREATION_TRANSACTION_SCHEMA_ID,
  type: 'object',
  properties: {
    created: { type: 'string', isDate: true },
    creator: { type: 'string' },
    transactionHash: { type: 'string' },
    factoryAddress: { type: 'string' },
    masterCopy: { type: 'string', nullable: true },
    setupData: { type: 'string', nullable: true },
    dataDecoded: {
      oneOf: [
        {
          $ref: '../data-decoded/data-decoded.json',
        },
        { type: 'null' },
      ],
    },
  },
  required: ['created', 'creator', 'transactionHash'],
};
