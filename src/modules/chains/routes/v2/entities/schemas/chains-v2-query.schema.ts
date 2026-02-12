import { z } from 'zod';

export const ChainsV2QuerySchema = z.object({
  serviceKey: z.string().min(1, 'serviceKey is required'),
});
