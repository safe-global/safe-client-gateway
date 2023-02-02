import { Schema } from 'ajv';

export const creationTransactionSchema: Schema = {
  $id: 'https://safe-client.safe.global/schemas/safe/creation-transaction.json',
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
  required: ['created', 'creator', 'transactionhash'],
};
