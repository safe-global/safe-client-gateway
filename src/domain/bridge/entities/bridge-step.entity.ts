import { z } from 'zod';
import { GasCostSchema } from '@/domain/bridge/entities/bridge-quote.entity';
import { FeeCostSchema } from '@/domain/bridge/entities/fee-cost.entity';
import { TypedDataSchema } from '@/domain/messages/entities/typed-data.entity';
import { TokenSchema } from '@/domain/tokens/entities/token.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';

// Adapted from LiFiStep of @lifi/types
// @see https://github.com/lifinance/types/blob/f87f67730de3aa22e63fe2b4337115d2998c76ea/src/step.ts#L139

export const ActionSchema = z.object({
  fromChainId: z.coerce.string(),
  fromAmount: z.string(),
  fromToken: TokenSchema,
  fromAddress: AddressSchema.nullish().default(null),
  toChainId: z.coerce.string(),
  toToken: TokenSchema,
  toAddress: AddressSchema.nullish().default(null),
  slippage: z.number().nullish().default(null),
});

export type Action = z.infer<typeof ActionSchema>;

export const EstimateSchema = z.object({
  tool: z.string(),
  fromAmount: z.string(),
  fromAmountUSD: z.string().nullish().default(null),
  toAmount: z.string(),
  toAmountMin: z.string(),
  toAmountUSD: z.string().nullish().default(null),
  approvalAddress: AddressSchema,
  feeCosts: z.array(FeeCostSchema).nullish().default(null),
  // This is a list to account for approval gas costs and transaction gas costs. However, approval gas costs are not used at the moment
  gasCosts: z.array(GasCostSchema).nullish().default(null),
  // estimated duration in seconds
  executionDuration: z.number(),
});

export type Estimate = z.infer<typeof EstimateSchema>;

export const StepToolDetailsSchema = z.object({
  key: z.string(),
  name: z.string(),
  logoURI: z.string(),
});

export type StepToolDetails = z.infer<typeof StepToolDetailsSchema>;

export const TransactionRequestSchema = z.object({
  to: AddressSchema.nullish().default(null),
  from: AddressSchema.nullish().default(null),
  nonce: z.number().nullish().default(null),
  gasLimit: z.string().nullish().default(null),
  gasPrice: z.string().nullish().default(null),
  data: HexSchema.nullish().default(null),
  value: z.string().nullish().default(null),
  chainId: z.coerce.string().nullish().default(null),
  type: z.number().nullish().default(null),
  accessList: z
    .array(
      z.object({
        address: AddressSchema,
        storageKeys: z.array(z.string()),
      }),
    )
    .nullish()
    .default(null),
  maxPriorityFeePerGas: z.string().nullish().default(null),
  maxFeePerGas: z.string().nullish().default(null),
  customData: z.record(z.unknown()).nullish().default(null),
  ccipReadEnabled: z.boolean().nullish().default(null),
});

export type TransactionRequest = z.infer<typeof TransactionRequestSchema>;

export const StepTypes = [
  'lifi',
  'swap',
  'cross',
  'protocol',
  'custom',
] as const;

export const StepBaseSchema = z.object({
  id: z.string(),
  type: z.enum([...StepTypes, 'unknown']).catch('unknown'),
  tool: z.string(),
  toolDetails: StepToolDetailsSchema,
  integrator: z.string().nullish().default(null),
  referrer: z.string().nullish().default(null),
  action: ActionSchema,
  estimate: EstimateSchema.nullish().default(null),
  transactionRequest: TransactionRequestSchema.nullish().default(null),
  typedData: z.array(TypedDataSchema).nullish().default(null),
});

export type StepBase = z.infer<typeof StepBaseSchema>;

export const SwapStepSchema = StepBaseSchema.extend({
  type: z.literal('swap'),
  action: ActionSchema,
  estimate: EstimateSchema,
});

export type SwapStep = z.infer<typeof SwapStepSchema>;

export const CrossStepSchema = StepBaseSchema.extend({
  type: z.literal('cross'),
  action: ActionSchema,
  estimate: EstimateSchema,
});

export type CrossStep = z.infer<typeof CrossStepSchema>;

export const ProtocolStepSchema = StepBaseSchema.extend({
  type: z.literal('protocol'),
  action: ActionSchema,
  estimate: EstimateSchema,
});

export type ProtocolStep = z.infer<typeof ProtocolStepSchema>;

export const CallActionSchema = ActionSchema.extend({
  toContractAddress: AddressSchema,
  toContractCallData: HexSchema,
  toFallbackAddress: AddressSchema,
  callDataGasLimit: z.string(),
});

export type CallAction = z.infer<typeof CallActionSchema>;

export const CustomStepSchema = StepBaseSchema.extend({
  type: z.literal('custom'),
  action: CallActionSchema,
  estimate: EstimateSchema,
});

export type CustomStep = z.infer<typeof CustomStepSchema>;

export const StepSchema = z.discriminatedUnion('type', [
  SwapStepSchema,
  CrossStepSchema,
  ProtocolStepSchema,
  CustomStepSchema,
]);

export type Step = z.infer<typeof StepSchema>;
