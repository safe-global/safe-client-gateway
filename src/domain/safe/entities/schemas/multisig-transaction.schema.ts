import { Schema } from 'ajv';

export const confirmationSchema: Schema = {
  type: 'object',
  properties: {
    owner: { type: 'string' },
    submissionDate: { type: 'string', isDate: true },
    transactionHash: { type: 'string', nullable: true },
    signatureType: { type: 'string' },
    signature: { type: 'string', nullable: true },
  },
  required: ['owner', 'submissionDate', 'signatureType'],
};

export const multisigTransactionSchema: Schema = {
  type: 'object',
  properties: {
    safe: { type: 'string' },
    to: { type: 'string' },
    value: { type: 'string', nullable: true },
    data: { type: 'string', nullable: true },
    dataDecoded: { type: 'object', nullable: true },
    operation: { type: 'number', enum: [0, 1] },
    gasToken: { type: 'string', nullable: true },
    safeTxGas: { type: 'number', nullable: true },
    baseGas: { type: 'number', nullable: true },
    gasPrice: { type: 'string', nullable: true },
    refundReceiver: { type: 'string', nullable: true },
    nonce: { type: 'number' },
    executionDate: {
      type: 'string',
      nullable: true,
      isDate: true,
    },
    submissionDate: {
      type: 'string',
      nullable: true,
      isDate: true,
    },
    modified: {
      type: 'string',
      nullable: true,
      isDate: true,
    },
    blockNumber: { type: 'number', nullable: true },
    transactionHash: { type: 'string', nullable: true },
    safeTxHash: { type: 'string' },
    executor: { type: 'string', nullable: true },
    isExecuted: { type: 'boolean' },
    isSuccessful: { type: 'boolean', nullable: true },
    ethGasPrice: { type: 'string', nullable: true },
    gasUsed: { type: 'number', nullable: true },
    fee: { type: 'string', nullable: true },
    origin: { type: 'string', nullable: true },
    confirmationsRequired: { type: 'number', nullable: true },
    confirmations: {
      type: 'array',
      nullable: true,
      items: confirmationSchema,
    },
    signatures: { type: 'string', nullable: true },
  },
  required: ['safe', 'to', 'operation', 'nonce', 'safeTxHash', 'isExecuted'],
};
