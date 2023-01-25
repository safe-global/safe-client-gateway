import { Schema } from 'ajv';
import { dataDecodedSchema } from '../../../data-decoder/entities/schemas/data-decoded.schema';

export const creationTransactionSchema: Schema = {
  type: 'object',
  properties: {
    created: { type: 'string', isDate: true },
    creator: { type: 'string' },
    transactionHash: { type: 'string' },
    factoryAddress: { type: 'string', nullable: true },
    masterCopy: { type: 'string', nullable: true },
    setupData: { type: 'string', nullable: true },
    dataDecoded: { oneOf: [dataDecodedSchema, { type: 'null' }] },
  },
  required: ['created', 'creator', 'transactionhash'],
};
