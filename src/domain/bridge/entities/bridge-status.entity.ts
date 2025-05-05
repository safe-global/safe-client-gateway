import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

// Adapted from StatusResponse of @lifi/types
// @see https://github.com/lifinance/types/blob/f87f67730de3aa22e63fe2b4337115d2998c76ea/src/api.ts#L535

export const StatusMessages = [
  // The transaction was not found -- likely not mined yet
  'NOT_FOUND',
  // A third party service is not available
  'INVALID',
  // The transfer is pending
  'PENDING',
  // The transfer is done
  'DONE',
  // The transfer failed
  'FAILED',
] as const;

export const SubstatusesPending = [
  // The bridge is waiting for additional confirmations
  'WAIT_SOURCE_CONFIRMATIONS',
  // The off-chain logic is in progress, waiting for the destination tx to be mined
  'WAIT_DESTINATION_TRANSACTION',
  // The bridge API / subgraph is temporarily unavailable
  'BRIDGE_NOT_AVAILABLE',
  // The RPC for source/destination chain is temporarily unavailable
  'CHAIN_NOT_AVAILABLE',
  // A refund has been requested and is in progress
  'REFUND_IN_PROGRESS',
  // We cannot determine the status of the transfer
  'UNKNOWN_ERROR',
] as const;

export const SubstatusesDone = [
  // The transfer was successful
  'COMPLETED',
  // The transfer was partially successful
  // This can happen for specific bridges like Across
  // which may provide alternative tokens in case of low liquidity
  'PARTIAL',
  // The transfer was not successful but it has been refunded
  'REFUNDED',
] as const;

export const SubstatusesFailed = [
  // The amount in the request exceeds the allowance
  'INSUFFICIENT_ALLOWANCE',
  // The token amount is not enough to execute the transfer
  'INSUFFICIENT_BALANCE',
  // The gas limit is lower than tx would consume
  'OUT_OF_GAS',
  // The requested quote is expired and can’t be processed anymore
  'EXPIRED',
  // Slippage conditions were not met
  'SLIPPAGE_EXCEEDED',
  // We cannot determine the cause of the failure
  'UNKNOWN_FAILED_ERROR',
] as const;

export const BaseStatusDataSchema = z.object({
  status: z.enum([...StatusMessages, 'UNKNOWN']).catch('UNKNOWN'),
  substatus: z
    .enum([
      ...SubstatusesPending,
      ...SubstatusesDone,
      ...SubstatusesFailed,
      'UNKNOWN',
    ])
    .catch('UNKNOWN'),
  substatusMessage: z.string().nullish().default(null),
});

export const BaseTransactionInfoSchema = z.object({
  txHash: z.string(),
  chainId: z.coerce.string(),
  txLink: z.string(),
});

export type BaseTransactionInfo = z.infer<typeof BaseTransactionInfoSchema>;

export const TokenSchema = z.object({
  chainId: z.coerce.string(),
  address: AddressSchema,
  symbol: z.string(),
  decimals: z.number(),
  name: z.string(),
  coinKey: z.string().nullish().default(null),
  logoURI: z.string().nullish().default(null),
  priceUSD: z.string(),
});

export type Token = z.infer<typeof TokenSchema>;

export const SetupToolDetailsSchema = z.object({
  key: z.string(),
  name: z.string(),
  logoURI: z.string(),
});

export type SetupToolDetails = z.infer<typeof SetupToolDetailsSchema>;

export const IncludedStepSchema = z.object({
  fromAmount: z.string(),
  fromToken: TokenSchema,
  toAmount: z.string(),
  toToken: TokenSchema,
  bridgedAmount: z.string().nullish().default(null),
  tool: z.string(),
  toolDetails: SetupToolDetailsSchema,
});

export type IncludedStep = z.infer<typeof IncludedStepSchema>;

export const PendingReceivingInfoSchema = z.object({
  chainId: z.coerce.string(),
});

export type PendingReceivingInfo = z.infer<typeof PendingReceivingInfoSchema>;

export const ExtendedTransactionInfoSchema = BaseTransactionInfoSchema.extend({
  amount: z.string().nullish().default(null),
  amountUSD: z.string().nullish().default(null),
  token: TokenSchema.nullish().default(null),
  gasPrice: z.string(),
  gasUsed: z.string(),
  gasToken: TokenSchema,
  gasAmount: z.string(),
  gasAmountUSD: z.string(),
  timestamp: z.number().nullish().default(null),
  value: z.string().nullish().default(null),
  includedSteps: z.array(IncludedStepSchema).nullish().default(null),
});

export type ExtendedTransactionInfo = z.infer<
  typeof ExtendedTransactionInfoSchema
>;

export const FeeCostSchema = z.object({
  name: z.string(),
  description: z.string(),
  percentage: z.string(),
  token: TokenSchema,
  amount: z.string(),
  amountUSD: z.string(),
  included: z.boolean(),
});

export type FeeCost = z.infer<typeof FeeCostSchema>;

export const TransferMetadataSchema = z.object({
  integrator: z.string(),
});

export type TransferMetadata = z.infer<typeof TransferMetadataSchema>;

export const FullStatusDataSchema = BaseStatusDataSchema.extend({
  transactionId: z.string(),
  sending: ExtendedTransactionInfoSchema,
  receiving: z.union([
    PendingReceivingInfoSchema,
    ExtendedTransactionInfoSchema,
  ]),
  feeCosts: z.array(FeeCostSchema),
  lifiExplorerLink: z.string(),
  fromAddress: AddressSchema,
  toAddress: AddressSchema,
  metadata: TransferMetadataSchema,
  bridgeExplorerLink: z.string().nullish().default(null),
});

export type FullStatusData = z.infer<typeof FullStatusDataSchema>;

export const StatusDataSchema = BaseStatusDataSchema.extend({
  tool: z.string(),
  sending: BaseTransactionInfoSchema,
  receiving: PendingReceivingInfoSchema,
});

export type StatusData = z.infer<typeof StatusDataSchema>;

export const FailedStatusDataSchema = BaseStatusDataSchema.extend({
  status: z.literal('FAILED'),
  sending: BaseTransactionInfoSchema,
});

export type FailedStatusData = z.infer<typeof FailedStatusDataSchema>;

export const BridgeStatusSchema = z.union([
  FullStatusDataSchema,
  StatusDataSchema,
  FailedStatusDataSchema,
]);

export type BridgeStatus = z.infer<typeof BridgeStatusSchema>;
