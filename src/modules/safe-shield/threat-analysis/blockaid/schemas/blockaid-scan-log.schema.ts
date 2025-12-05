import { z } from 'zod';

export const BlockaidScanLogSchema = z.object({
  chain: z.string(),
  request_id: z.string().optional(),
  validation: z
    .object({
      status: z.string(),
      result_type: z.string(),
      description: z.string().optional(),
      features: z
        .array(
          z.object({
            type: z.string(),
            feature_id: z.string(),
          }),
        )
        .optional(),
    })
    .optional(),
  simulation: z
    .object({
      status: z.string(),
    })
    .optional(),
});

export type BlockaidScanLog = z.infer<typeof BlockaidScanLogSchema>;
