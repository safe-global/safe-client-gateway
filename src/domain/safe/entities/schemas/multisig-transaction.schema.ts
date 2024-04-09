import { Schema } from 'ajv';
import { buildPageSchema } from '@/domain/entities/schemas/page.schema.factory';
import { buildZodPageSchema } from '@/domain/entities/schemas/page.schema.factory';
import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';
import { DataDecodedSchema } from '@/domain/data-decoder/entities/schemas/data-decoded.schema';
import { Operation } from '@/domain/safe/entities/operation.entity';
import { SignatureType } from '@/domain/messages/entities/message-confirmation.entity';

export const ConfirmationSchema = z.object({
  owner: AddressSchema,
  submissionDate: z.coerce.date(),
  transactionHash: HexSchema.nullish().default(null),
  signatureType: z.nativeEnum(SignatureType),
  signature: HexSchema.nullish().default(null),
});

export const MultisigTransactionSchema = z.object({
  safe: AddressSchema,
  to: AddressSchema,
  value: NumericStringSchema.nullable().default(null),
  data: HexSchema.nullable().default(null),
  dataDecoded: DataDecodedSchema.nullable().default(null),
  operation: z.nativeEnum(Operation),
  gasToken: AddressSchema.nullable().default(null),
  safeTxGas: z.number().nullable().default(null),
  baseGas: z.number().nullable().default(null),
  gasPrice: NumericStringSchema.nullable().default(null),
  proposer: AddressSchema.nullable().default(null),
  refundReceiver: AddressSchema.nullable().default(null),
  nonce: z.number(),
  executionDate: z.coerce.date().nullable().default(null),
  submissionDate: z.coerce.date(),
  modified: z.coerce.date().nullable().default(null),
  blockNumber: z.number().nullable().default(null),
  transactionHash: HexSchema.nullish().default(null),
  safeTxHash: HexSchema,
  executor: AddressSchema.nullable().default(null),
  isExecuted: z.boolean(),
  isSuccessful: z.boolean().nullable().default(null),
  ethGasPrice: NumericStringSchema.nullable().default(null),
  gasUsed: z.number().nullable().default(null),
  fee: NumericStringSchema.nullable().default(null),
  origin: z.string().nullable().default(null),
  confirmationsRequired: z.number().nullable().default(null),
  confirmations: z.array(ConfirmationSchema).nullable().default(null),
  signatures: HexSchema.nullable().default(null),
  trusted: z.boolean(),
});

export const MultisigTransactionPageSchema = buildZodPageSchema(
  MultisigTransactionSchema,
);

// TODO: Remove after migrating transactionTypeSchema
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
