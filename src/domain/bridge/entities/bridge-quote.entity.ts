import {
  SwapStepSchema,
  CrossStepSchema,
  ProtocolStepSchema,
  CustomStepSchema,
  StepSchema,
} from '@/domain/bridge/entities/bridge-step.entity';
import { TokenSchema } from '@/domain/bridge/entities/token.entity';
import { z } from 'zod';

export const GasCostTypes = ['SUM', 'APPROVE', 'SEND', 'FEE'] as const;

export const GasCostSchema = z.object({
  type: z.enum([...GasCostTypes, 'UNKNOWN']).catch('UNKNOWN'),
  // suggested current standard price for chain
  price: z.string(),
  // estimate how much gas will be needed
  estimate: z.string(),
  // suggested gas limit (estimate +25%)
  limit: z.string(),
  // estimate * price = amount of tokens that will be needed
  amount: z.string(),
  // usd value of token amount
  amountUSD: z.string(),
  // the used gas token
  token: TokenSchema,
});

export type GasCost = z.infer<typeof GasCostSchema>;

export const BridgeQuoteSchema = z.intersection(
  // StepSchema cannot be extended as it is a discriminated union
  z.union([
    SwapStepSchema.omit({ type: true }),
    CrossStepSchema.omit({ type: true }),
    ProtocolStepSchema.omit({ type: true }),
    CustomStepSchema.omit({ type: true }),
  ]),
  z.object({
    type: z.literal('lifi'),
    includedSteps: z.array(StepSchema),
  }),
);

export type BridgeQuote = z.infer<typeof BridgeQuoteSchema>;
