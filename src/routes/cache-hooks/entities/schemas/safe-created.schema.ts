import { EventType } from '@/routes/cache-hooks/entities/event-type.entity';
import { z } from 'zod';

export const SafeCreatedEventSchema = z.object({
  type: z.literal(EventType.SAFE_CREATED),
  chainId: z.string(),
});
