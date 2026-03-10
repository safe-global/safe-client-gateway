import { buildPageSchema } from '@/domain/entities/schemas/page.schema.factory';
import { z } from 'zod';

export const SpaceMultisigTransactionConfirmationSchema = z.object({
  owner: z.string(),
  signature: z.string().nullish().default(null),
  signatureType: z.string().nullish().default(null),
  created: z.coerce.date().nullish().default(null),
  modified: z.coerce.date().nullish().default(null),
});

export const SpaceMultisigTransactionSchema = z.object({
  safeTxHash: z.string(),
  chainId: z.string(),
  safe: z.string(),
  nonce: z.string(),
  proposer: z.string().nullish().default(null),
  proposedByDelegate: z.string().nullish().default(null),
  to: z.string(),
  value: z.string(),
  data: z.string().nullish().default(null),
  operation: z.number(),
  safeTxGas: z.string(),
  baseGas: z.string(),
  gasPrice: z.string(),
  gasToken: z.string().nullish().default(null),
  refundReceiver: z.string().nullish().default(null),
  failed: z.boolean().nullish().default(null),
  notes: z.string().nullish().default(null),
  originName: z.string().nullish().default(null),
  originUrl: z.string().nullish().default(null),
  txHash: z.string().nullish().default(null),
  created: z.coerce.date().nullish().default(null),
  modified: z.coerce.date().nullish().default(null),
  confirmations: z
    .array(SpaceMultisigTransactionConfirmationSchema)
    .nullish()
    .default(null),
});

export type SpaceMultisigTransaction = z.infer<
  typeof SpaceMultisigTransactionSchema
>;

export const SpaceMultisigTransactionPageSchema = buildPageSchema(
  SpaceMultisigTransactionSchema,
);

export type SpaceMultisigTransactionPage = z.infer<
  typeof SpaceMultisigTransactionPageSchema
>;
