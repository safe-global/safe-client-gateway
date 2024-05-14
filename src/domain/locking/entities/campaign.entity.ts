import { CampaignSchema } from '@/domain/locking/entities/schemas/campaign.schema';
import { z } from 'zod';

export type Campaign = z.infer<typeof CampaignSchema>;
