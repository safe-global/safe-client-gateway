import type { EstimationSchema } from '@/domain/estimations/entities/schemas/estimation.schema';
import type { z } from 'zod';

export type Estimation = z.infer<typeof EstimationSchema>;
