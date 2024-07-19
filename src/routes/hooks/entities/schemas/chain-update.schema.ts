import { ConfigEventType } from '@/routes/hooks/entities/event-type.entity';
import { z } from 'zod';

export const ChainUpdateEventSchema = z.object({
  type: z.literal(ConfigEventType.CHAIN_UPDATE),
  chainId: z.string(),
});
