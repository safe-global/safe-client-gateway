import { EventType } from '@/routes/cache-hooks/entities/event-type.entity';
import { z } from 'zod';

export const ChainUpdateEventSchema = z.object({
  type: z.literal(EventType.CHAIN_UPDATE),
  chainId: z.string(),
});
