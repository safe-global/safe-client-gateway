// SPDX-License-Identifier: FSL-1.1-MIT
import type { z } from 'zod';
import type {
  DataDecodedParameterSchema,
  DataDecodedSchema,
} from '@/modules/data-decoder/domain/v1/entities/schemas/data-decoded.schema';

export type DataDecodedParameter = z.infer<typeof DataDecodedParameterSchema>;

export type DataDecoded = z.infer<typeof DataDecodedSchema>;
