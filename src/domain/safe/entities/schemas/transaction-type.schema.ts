import { Schema } from 'ajv';
import { moduleTransactionTypeSchema } from './module-transaction-type.schema';
import { multisigTransactionTypeSchema } from './multisig-transaction-type.schema';
import { ethereumTransactionTypeSchema } from './ethereum-transaction-type.schema';

export const transactionTypeSchema: Schema = {
  type: 'object',
  discriminator: { propertyName: 'txType' },
  required: ['txType'],
  oneOf: [
    ethereumTransactionTypeSchema,
    moduleTransactionTypeSchema,
    multisigTransactionTypeSchema,
  ],
};
