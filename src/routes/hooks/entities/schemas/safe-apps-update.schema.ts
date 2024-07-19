import { ConfigEventType } from '@/routes/hooks/entities/event-type.entity';
import { z } from 'zod';

export const SafeAppsUpdateEventSchema = z.object({
  type: z.literal(ConfigEventType.SAFE_APPS_UPDATE),
  chainId: z.string(),
});
