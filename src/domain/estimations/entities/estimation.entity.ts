import { EstimationSchema } from '@/domain/estimations/entities/schemas/estimation.schema';
import { z } from 'zod';

export type Estimation = z.infer<typeof EstimationSchema>;
