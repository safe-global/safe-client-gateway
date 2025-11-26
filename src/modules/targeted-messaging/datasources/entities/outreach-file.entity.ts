import { z } from 'zod';
import { TargetedSafeEntrySchema } from '@/modules/targeted-messaging/domain/entities/targeted-safe-entry.entity';

export type OutreachFile = z.infer<typeof OutreachFileSchema>;

export const OutreachFileSchema = z.object({
  campaign_id: z.number().int().min(1),
  campaign_name: z.string(),
  team_name: z.string(),
  start_date: z.coerce.date(),
  end_date: z.coerce.date(),
  safe_addresses: z.array(TargetedSafeEntrySchema),
});
