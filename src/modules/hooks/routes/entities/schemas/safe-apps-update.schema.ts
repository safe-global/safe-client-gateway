import { z } from 'zod';
import { ConfigEventType } from '@/modules/hooks/routes/entities/event-type.entity';

export const SafeAppsUpdateEventSchema = z.object({
  type: z.literal(ConfigEventType.SAFE_APPS_UPDATE),
  chainId: z.string(),
});
