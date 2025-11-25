import { z } from 'zod';
import { TargetedSafeEntrySchema } from '@/modules/targeted-messaging/domain/entities/targeted-safe-entry.entity';

export type OutreachFile = z.infer<typeof OutreachFileSchema>;

// Target safe can be either:
// 1. Simple address string (legacy): "0xABC..."
// 2. Object with address and chainId: { address: "0xABC...", chainId: "1" }
const TargetedSafeEntrySchema = z.union([
  // Legacy format: just the address
  AddressSchema,
  // New format: object with address and optional chainId
  z.object({
    address: AddressSchema,
    chainId: z.string(),
  }),
]);

export const OutreachFileSchema = z.object({
  campaign_id: z.number().int().min(1),
  campaign_name: z.string(),
  team_name: z.string(),
  start_date: z.coerce.date(),
  end_date: z.coerce.date(),
  safe_addresses: z.array(TargetedSafeEntrySchema),
});
