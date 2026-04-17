import { z } from 'zod';
import { ConfigEventType } from '@/modules/hooks/routes/entities/event-type.entity';

export const ChainUpdateEventSchema = z.object({
  type: z.literal(ConfigEventType.CHAIN_UPDATE),
  chainId: z.string(),
  service: z.string().optional(),
});
