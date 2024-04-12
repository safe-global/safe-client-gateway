import { buildPageSchema } from '@/domain/entities/schemas/page.schema.factory';
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

export const MultisigTransactionTypeSchema = MultisigTransactionSchema.extend({
  txType: z.literal('MULTISIG_TRANSACTION'),
});

export const MultisigTransactionPageSchema = buildPageSchema(
  MultisigTransactionSchema,
);
