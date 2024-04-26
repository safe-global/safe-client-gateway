import { DataDecodedSchema } from '@/domain/data-decoder/entities/schemas/data-decoded.schema';
import { buildPageSchema } from '@/domain/entities/schemas/page.schema.factory';
import { SignatureType } from '@/domain/messages/entities/message-confirmation.entity';
import { Operation } from '@/domain/safe/entities/operation.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';
import { z } from 'zod';

export type Confirmation = z.infer<typeof ConfirmationSchema>;

export type MultisigTransaction = z.infer<typeof MultisigTransactionSchema>;

const ConfirmationSchema = z.object({
  owner: AddressSchema,
  submissionDate: z.coerce.date(),
  transactionHash: HexSchema.nullish().default(null),
  signatureType: z.nativeEnum(SignatureType),
  signature: HexSchema.nullish().default(null),
});

export const MultisigTransactionSchema = z.object({
  safe: AddressSchema,
  to: AddressSchema,
  value: NumericStringSchema,
  data: HexSchema.nullish().default(null),
  dataDecoded: DataDecodedSchema.nullish().default(null),
  operation: z.nativeEnum(Operation),
  gasToken: AddressSchema.nullish().default(null),
  safeTxGas: z.number().nullish().default(null),
  baseGas: z.number().nullish().default(null),
  gasPrice: NumericStringSchema.nullish().default(null),
  proposer: AddressSchema.nullish().default(null),
  refundReceiver: AddressSchema.nullish().default(null),
  nonce: z.number(),
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
