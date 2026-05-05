// SPDX-License-Identifier: FSL-1.1-MIT
import type { z } from 'zod';
import type { EstimationSchema } from '@/modules/estimations/domain/entities/schemas/estimation.schema';

export type Estimation = z.infer<typeof EstimationSchema>;
