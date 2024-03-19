import { EventType } from '@/routes/cache-hooks/entities/event-type.entity';
import { z } from 'zod';

export const SafeAppsUpdateEventSchema = z.object({
  type: z.literal(EventType.SAFE_APPS_UPDATE),
  chainId: z.string(),
});
