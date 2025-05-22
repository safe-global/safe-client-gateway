import { z } from 'zod';
import { StepSchema } from '@/domain/bridge/entities/bridge-step.entity';
import { TokenSchema } from '@/domain/bridge/entities/token.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

export const OrderTypes = ['FASTEST', 'CHEAPEST'] as const;

export const OrderTypeSchema = z
  .enum([...OrderTypes, 'UNKNOWN'])
  .catch('UNKNOWN');

export type OrderType = z.infer<typeof OrderTypeSchema>;

export const BridgeRouteSchema = z.object({
  id: z.string(),
  fromChainId: z.coerce.string(),
  fromAmountUSD: z.string(),
  fromAmount: z.string(),
  fromToken: TokenSchema,
  fromAddress: AddressSchema.nullish().default(null),
  toChainId: z.coerce.string(),
  toAmountUSD: z.string(),
  toAmount: z.string(),
  toAmountMin: z.string(),
  toToken: TokenSchema,
  toAddress: AddressSchema.nullish().default(null),
  gasCostUSD: z.string().nullish().default(null),
  containsSwitchChain: z.boolean().nullish().default(null),
  steps: z.array(StepSchema),
  tags: z.array(OrderTypeSchema).nullish().default(null),
});

export type BridgeRoute = z.infer<typeof BridgeRouteSchema>;

export const BridgeRoutesResponseSchema = z.object({
  routes: z.array(BridgeRouteSchema),
});

export type BridgeRoutesResponse = z.infer<typeof BridgeRoutesResponseSchema>;
