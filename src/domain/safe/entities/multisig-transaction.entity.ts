import { buildPageSchema } from '@/domain/entities/schemas/page.schema.factory';
import { SignatureType } from '@/domain/common/entities/signature-type.entity';
import { Operation } from '@/domain/safe/entities/operation.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';
import { z } from 'zod';
import { CoercedNumberSchema } from '@/validation/entities/schemas/coerced-number.schema';
import { HexBytesSchema } from '@/validation/entities/schemas/hexbytes.schema';

export type Confirmation = z.infer<typeof ConfirmationSchema>;

export type MultisigTransaction = z.infer<typeof MultisigTransactionSchema>;

export const ConfirmationSchema = z.object({
  owner: AddressSchema,
  submissionDate: z.coerce.date(),
  transactionHash: HexSchema.nullish().default(null),
  signatureType: z.nativeEnum(SignatureType),
  // We don't validate signature length as they are on the Transaction Service
  signature: HexBytesSchema.nullish().default(null),
});

export const MultisigTransactionSchema = z.object({
  safe: AddressSchema,
  to: AddressSchema,
  value: NumericStringSchema,
  data: HexSchema.nullish().default(null),
  operation: z.nativeEnum(Operation),
  gasToken: AddressSchema.nullish().default(null),
  safeTxGas: CoercedNumberSchema.nullish().default(null),
  baseGas: CoercedNumberSchema.nullish().default(null),
  gasPrice: NumericStringSchema.nullish().default(null),
  proposer: AddressSchema.nullish().default(null),
  proposedByDelegate: AddressSchema.nullish().default(null),
  refundReceiver: AddressSchema.nullish().default(null),
  nonce: CoercedNumberSchema,
  executionDate: z.coerce.date().nullish().default(null),
  submissionDate: z.coerce.date(),
  modified: z.coerce.date().nullish().default(null),
  blockNumber: z.number().nullish().default(null),
  transactionHash: HexSchema.nullish().default(null),
  safeTxHash: HexSchema,
  executor: AddressSchema.nullish().default(null),
  isExecuted: z.boolean(),
  isSuccessful: z.boolean().nullish().default(null),
  ethGasPrice: NumericStringSchema.nullish().default(null),
  gasUsed: z.number().nullish().default(null),
  fee: NumericStringSchema.nullish().default(null),
  origin: z.string().nullish().default(null),
  confirmationsRequired: z.number(),
  confirmations: z.array(ConfirmationSchema).nullish().default(null),
  signatures: HexSchema.nullish().default(null),
  trusted: z.boolean(),
});

export const MultisigTransactionTypeSchema = MultisigTransactionSchema.extend({
  txType: z.literal('MULTISIG_TRANSACTION'),
});

export const MultisigTransactionPageSchema = buildPageSchema(
  MultisigTransactionSchema,
);
