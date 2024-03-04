import { Schema } from 'ajv';
import { buildPageSchema } from '@/domain/entities/schemas/page.schema.factory';

export const CONFIRMATION_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/safe/confirmation.json';

export const confirmationSchema: Schema = {
  $id: CONFIRMATION_SCHEMA_ID,
  type: 'object',
  properties: {
    owner: { type: 'string' },
    submissionDate: { type: 'string', isDate: true },
    transactionHash: { type: 'string', nullable: true, default: null },
    signatureType: { type: 'string' },
    signature: { type: 'string', nullable: true, default: null },
  },
  required: ['owner', 'submissionDate', 'signatureType'],
};

export const MULTISIG_TRANSACTION_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/safe/multisig-transaction.json';

export const multisigTransactionSchema: Schema = {
  $id: MULTISIG_TRANSACTION_SCHEMA_ID,
  type: 'object',
  properties: {
    safe: { type: 'string' },
    to: { type: 'string' },
    value: { type: 'string', nullable: true, default: null },
    data: { type: 'string', nullable: true, default: null },
    dataDecoded: {
      anyOf: [
        { type: 'null' },
        {
          $ref: '../data-decoded/data-decoded.json',
        },
      ],
      default: null,
    },
    operation: { type: 'number', enum: [0, 1] },
    gasToken: { type: 'string', nullable: true, default: null },
    safeTxGas: { type: 'number', nullable: true, default: null },
    baseGas: { type: 'number', nullable: true, default: null },
    gasPrice: { type: 'string', nullable: true, default: null },
    proposer: { type: 'string', nullable: true, default: null },
    refundReceiver: { type: 'string', nullable: true, default: null },
    nonce: { type: 'number' },
    executionDate: {
      type: 'string',
      nullable: true,
      isDate: true,
      default: null,
    },
    submissionDate: { type: 'string', isDate: true },
    modified: {
      type: 'string',
      nullable: true,
      isDate: true,
      default: null,
    },
    blockNumber: { type: 'number', nullable: true, default: null },
    transactionHash: { type: 'string', nullable: true, default: null },
    safeTxHash: { type: 'string' },
    executor: { type: 'string', nullable: true, default: null },
    isExecuted: { type: 'boolean' },
    isSuccessful: { type: 'boolean', nullable: true, default: null },
    ethGasPrice: { type: 'string', nullable: true, default: null },
    gasUsed: { type: 'number', nullable: true, default: null },
    fee: { type: 'string', nullable: true, default: null },
    origin: { type: 'string', nullable: true, default: null },
    confirmationsRequired: { type: 'number', nullable: true, default: null },
    confirmations: {
      type: 'array',
      nullable: true,
      items: {
        $ref: 'confirmation.json',
      },
      default: null,
    },
    signatures: { type: 'string', nullable: true, default: null },
    trusted: { type: 'boolean' },
  },
  required: [
    'safe',
    'to',
    'operation',
    'nonce',
    'submissionDate',
    'safeTxHash',
    'isExecuted',
    'trusted',
  ],
};

export const MULTISIG_TRANSACTION_PAGE_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/safe/multisig-transaction-page.json';

export const multisigTransactionPageSchema: Schema = buildPageSchema(
  MULTISIG_TRANSACTION_PAGE_SCHEMA_ID,
  multisigTransactionSchema,
);
