import { DataDecodedSchema } from '@/domain/data-decoder/v1/entities/schemas/data-decoded.schema';
import { buildPageSchema } from '@/domain/entities/schemas/page.schema.factory';
import { SignatureType } from '@/domain/common/entities/signature-type.entity';
import { Operation } from '@/domain/safe/entities/operation.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';
import { z } from 'zod';
import { CoercedNumberSchema } from '@/validation/entities/schemas/coerced-number.schema';
import { isAddressEqual, recoverAddress, recoverMessageAddress } from 'viem';

export type Confirmation = z.infer<typeof ConfirmationSchema>;

export type MultisigTransaction = z.infer<typeof MultisigTransactionSchema>;

export const ConfirmationSchema = z.object({
  owner: AddressSchema,
  submissionDate: z.coerce.date(),
  transactionHash: HexSchema.nullish().default(null),
  signatureType: z.nativeEnum(SignatureType),
  signature: HexSchema.nullish().default(null),
});

const BaseMultisigTransactionSchema = z.object({
  safe: AddressSchema,
  to: AddressSchema,
  value: NumericStringSchema,
  data: HexSchema.nullish().default(null),
  dataDecoded: DataDecodedSchema.nullish().default(null),
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

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export async function _refineMultisigConfirmations(
  transaction: z.infer<typeof BaseMultisigTransactionSchema>,
  ctx: z.RefinementCtx,
) {
  if (process.env.FF_REFINE_MULTISIG_CONFIRMATIONS !== 'true') {
    return;
  }

  if (!transaction.confirmations || transaction.confirmations.length === 0) {
    return;
  }

  // Check for duplicates
  for (let i = 0; i < transaction.confirmations.length; i++) {
    const confirmation = transaction.confirmations[i];

    // Check for duplicates
    if (i > 0) {
      const otherConfirmations = transaction.confirmations.filter(
        (_, j) => j !== i,
      );

      const otherOwners = otherConfirmations.map((c) => c.owner);
      if (otherOwners.includes(confirmation.owner)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Duplicate owners',
        });
        return z.NEVER;
      }

      const otherSignatures = otherConfirmations.map((c) => c.signature);
      if (otherSignatures.includes(confirmation.signature)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Duplicate signatures',
        });
        return z.NEVER;
      }
    }

    if (!confirmation.signature) {
      continue;
    }

    // Validate signatures
    const rAndS = confirmation.signature.slice(0, -2) as `0x${string}`;
    const v = parseInt(confirmation.signature.slice(-2), 16);

    switch (confirmation.signatureType) {
      case SignatureType.ApprovedHash: {
        // v = 1
        // Approved on chain
        continue;
      }

      case SignatureType.ContractSignature: {
        // v = 0
        // Requires on-chain verification
        continue;
      }

      case SignatureType.Eoa: {
        // Transaction Service should type these correctly but we check in case
        if (v !== 27 && v !== 28) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${SignatureType.Eoa} signature must have v equal to 27 or 28`,
          });
          return z.NEVER;
        }

        let address: `0x${string}`;
        try {
          address = await recoverAddress({
            hash: transaction.safeTxHash,
            signature: confirmation.signature,
          });
        } catch {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Could not recover ${SignatureType.Eoa} address`,
          });
          return z.NEVER;
        }

        if (!isAddressEqual(address, confirmation.owner)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Invalid ${SignatureType.Eoa} signature`,
          });
        }

        break;
      }

      case SignatureType.EthSign: {
        // Transaction Service should type these correctly but we check in case
        if (v !== 31 && v !== 32) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${SignatureType.EthSign} signature must have v equal to 31 or 32`,
          });
          return z.NEVER;
        }

        // Undo v adjustment for eth_sign
        // @see https://docs.safe.global/advanced/smart-account-signatures#eth_sign-signature
        const signature = (rAndS + (v - 4).toString(16)) as `0x${string}`;

        let address: `0x${string}`;
        try {
          address = await recoverMessageAddress({
            message: {
              raw: transaction.safeTxHash,
            },
            signature,
          });
        } catch {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Could not recover ${SignatureType.EthSign} address`,
          });
          return z.NEVER;
        }

        if (!isAddressEqual(address, confirmation.owner)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Invalid ${SignatureType.EthSign} signature`,
          });
        }

        break;
      }

      default: {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Invalid signature type',
        });
        return z.NEVER;
      }
    }
  }
}

export const MultisigTransactionSchema =
  BaseMultisigTransactionSchema.superRefine(_refineMultisigConfirmations);

// ZodEffects can't be extended so we refine in TransactionTypeSchema
export const _MultisigTransactionTypeSchema =
  BaseMultisigTransactionSchema.extend({
    txType: z.literal('MULTISIG_TRANSACTION'),
  });

export const MultisigTransactionPageSchema = buildPageSchema(
  MultisigTransactionSchema,
);
