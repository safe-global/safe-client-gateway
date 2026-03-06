import { z } from 'zod';
import { AnalysisResultBaseSchema } from '../../entities/analysis-result.entity';
import { DeadlockStatusSchema } from './deadlock-status.entity';
import { CommonStatusSchema } from '../../entities/analysis-result.entity';

export const DeadlockAnalysisResultSchema = AnalysisResultBaseSchema.extend({
  type: z.union([DeadlockStatusSchema, CommonStatusSchema]),
});

export type DeadlockAnalysisResult = z.infer<
  typeof DeadlockAnalysisResultSchema
>;
