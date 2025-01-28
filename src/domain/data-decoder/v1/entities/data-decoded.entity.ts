import type {
  DataDecodedParameterSchema,
  DataDecodedSchema,
} from '@/domain/data-decoder/v1/entities/schemas/data-decoded.schema';
import type { z } from 'zod';

export type DataDecodedParameter = z.infer<typeof DataDecodedParameterSchema>;

export type DataDecoded = z.infer<typeof DataDecodedSchema>;
