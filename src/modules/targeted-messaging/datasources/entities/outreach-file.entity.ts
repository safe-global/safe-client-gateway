import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { z } from 'zod';

export type OutreachFile = z.infer<typeof OutreachFileSchema>;

export const OutreachFileSchema = z.object({
  campaign_id: z.number().int().min(1),
  campaign_name: z.string(),
  team_name: z.string(),
  start_date: z.coerce.date(),
  end_date: z.coerce.date(),
  safe_addresses: z.array(AddressSchema),
});
