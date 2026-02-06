import { TransactionEventType } from '@/modules/hooks/routes/entities/event-type.entity';
import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { HookEventBaseSchema } from '@/modules/hooks/routes/entities/schemas/hook-event-base.schema';

export const ModuleTransactionEventSchema = HookEventBaseSchema.extend({
  type: z.literal(TransactionEventType.MODULE_TRANSACTION),
  module: AddressSchema,
  txHash: z.string(),
});

export type ModuleTransactionEvent = z.infer<
  typeof ModuleTransactionEventSchema
>;
