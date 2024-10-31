import { z } from 'zod';
import { TransactionEventType } from '@/routes/hooks/entities/event-type.entity';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';

export const ReorgDetectedEventSchema = z.object({
  type: z.literal(TransactionEventType.REORG_DETECTED),
  chainId: NumericStringSchema,
  blockNumber: z.number().int(),
});

export type ReorgDetectedEvent = z.infer<typeof ReorgDetectedEventSchema>;
