// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { TransactionEventType } from '@/modules/hooks/routes/entities/event-type.entity';
import { HookEventBaseSchema } from '@/modules/hooks/routes/entities/schemas/hook-event-base.schema';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

export const IncomingTokenEventSchema = HookEventBaseSchema.extend({
  type: z.literal(TransactionEventType.INCOMING_TOKEN),
  tokenAddress: AddressSchema,
  txHash: z.string(),
});

export type IncomingTokenEvent = z.infer<typeof IncomingTokenEventSchema>;
