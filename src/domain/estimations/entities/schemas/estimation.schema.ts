import { z } from 'zod';

export const EstimationSchema = z.object({
  safeTxGas: z.string(),
});
