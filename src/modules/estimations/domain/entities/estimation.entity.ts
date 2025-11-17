import type { EstimationSchema } from '@/modules/estimations/domain/entities/schemas/estimation.schema';
import type { z } from 'zod';

export type Estimation = z.infer<typeof EstimationSchema>;
