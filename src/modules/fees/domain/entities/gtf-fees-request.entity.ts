// SPDX-License-Identifier: FSL-1.1-MIT
import type { z } from 'zod';
import type { GtfFeesRequestSchema } from '@/modules/fees/domain/entities/schemas/gtf-fees-request.schema';

export type GtfFeesRequest = z.infer<typeof GtfFeesRequestSchema>;
