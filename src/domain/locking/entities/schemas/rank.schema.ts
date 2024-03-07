import { z } from 'zod';
import { buildZodPageSchema } from '@/domain/entities/schemas/page.schema.factory';

// TODO: Add and test once defined
export const RankSchema = z.object({});

export const RankPageSchema = buildZodPageSchema(RankSchema);
