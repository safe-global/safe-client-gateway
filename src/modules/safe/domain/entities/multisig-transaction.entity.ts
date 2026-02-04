import { buildPageSchema } from '@/domain/entities/schemas/page.schema.factory';
import { SignatureType } from '@/domain/common/entities/signature-type.entity';
import { Operation } from '@/modules/safe/domain/entities/operation.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';
import { z } from 'zod';
import { CoercedNumberSchema } from '@/validation/entities/schemas/coerced-number.schema';
import { HexBytesSchema } from '@/validation/entities/schemas/hexbytes.schema';
import {
  NullableAddressSchema,
  NullableCoercedDateSchema,
  NullableHexSchema,
  NullableNumberSchema,
  NullableNumericStringSchema,
  NullableStringSchema,
} from '@/validation/entities/schemas/nullable.schema';

export type Confirmation = z.infer<typeof ConfirmationSchema>;

export type MultisigTransaction = z.infer<typeof MultisigTransactionSchema>;

export const ConfirmationSchema = z.object({
  owner: AddressSchema,
  submissionDate: z.coerce.date(),
  transactionHash: NullableHexSchema,
  signatureType: z.enum(SignatureType),
  // We don't validate signature length as they are on the Transaction Service
  signature: HexBytesSchema.nullish().default(null),
});

export const MultisigTransactionSchema = z.object({
  safe: AddressSchema,
  to: AddressSchema,
  value: NumericStringSchema,
  data: NullableHexSchema,
  operation: z.enum(Operation),
  gasToken: NullableAddressSchema,
  safeTxGas: CoercedNumberSchema.nullish().default(null),
  baseGas: CoercedNumberSchema.nullish().default(null),
  gasPrice: NullableNumericStringSchema,
  proposer: NullableAddressSchema,
  proposedByDelegate: NullableAddressSchema,
  refundReceiver: NullableAddressSchema,
  nonce: CoercedNumberSchema,
  executionDate: NullableCoercedDateSchema,
  submissionDate: z.coerce.date(),
  modified: NullableCoercedDateSchema,
  blockNumber: NullableNumberSchema,
  transactionHash: NullableHexSchema,
  safeTxHash: HexSchema,
  executor: NullableAddressSchema,
  isExecuted: z.boolean(),
  isSuccessful: z.boolean().nullish().default(null),
  ethGasPrice: NullableNumericStringSchema,
  gasUsed: NullableNumberSchema,
  fee: NullableNumericStringSchema,
  origin: NullableStringSchema,
  confirmationsRequired: z.number(),
  confirmations: z.array(ConfirmationSchema).nullish().default(null),
  signatures: NullableHexSchema,
  trusted: z.boolean(),
});

export const MultisigTransactionTypeSchema = MultisigTransactionSchema.extend({
  txType: z.literal('MULTISIG_TRANSACTION'),
});

export const MultisigTransactionPageSchema = buildPageSchema(
  MultisigTransactionSchema,
);
