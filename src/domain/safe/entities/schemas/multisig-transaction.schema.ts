import { Schema } from 'ajv';

export const confirmationSchema: Schema = {
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

export const multisigTransactionSchema: Schema = {
  type: 'object',
  properties: {
    safe: { type: 'string' },
    to: { type: 'string' },
    value: { type: 'string', nullable: true, default: null },
    data: { type: 'string', nullable: true, default: null },
    dataDecoded: {
      anyOf: [{ type: 'null' }, { $ref: 'dataDecodedSchema' }],
      default: null,
    },
    operation: { type: 'number', enum: [0, 1] },
    gasToken: { type: 'string', nullable: true, default: null },
    safeTxGas: { type: 'number', nullable: true, default: null },
    baseGas: { type: 'number', nullable: true, default: null },
    gasPrice: { type: 'string', nullable: true, default: null },
    refundReceiver: { type: 'string', nullable: true, default: null },
    nonce: { type: 'number' },
    executionDate: {
      type: 'string',
      nullable: true,
      isDate: true,
      default: null,
    },
    submissionDate: {
      type: 'string',
      nullable: true,
      isDate: true,
      default: null,
    },
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
      items: confirmationSchema,
      default: null,
    },
    signatures: { type: 'string', nullable: true, default: null },
  },
  required: [
    'safe',
    'to',
    'operation',
    'nonce',
    'submissionDate',
    'safeTxHash',
    'isExecuted',
  ],
};
