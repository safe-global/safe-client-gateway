import { Schema } from 'ajv';

export const MULTISIG_TRANSACTION_TYPE_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/safe/multisig-transaction-type.json';

export const multisigTransactionTypeSchema: Schema = {
  $id: MULTISIG_TRANSACTION_TYPE_SCHEMA_ID,
  type: 'object',
  properties: {
    txType: { type: 'string', const: 'MULTISIG_TRANSACTION' },
    safe: { type: 'string' },
    to: { type: 'string' },
    value: { type: 'string', nullable: true, default: null },
    data: { type: 'string', nullable: true, default: null },
    dataDecoded: {
      oneOf: [
        {
          $ref: '../data-decoded/data-decoded.json',
        },
        { type: 'null' },
      ],
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
      isDate: true,
      nullable: true,
      default: null,
    },
    submissionDate: { type: 'string', isDate: true },
    modified: { type: 'string', isDate: true, nullable: true, default: null },
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
    'txType',
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
