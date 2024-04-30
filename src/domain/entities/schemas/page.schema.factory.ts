import { z } from 'zod';
import { Page } from '@/domain/entities/page.entity';

export function buildPageSchema<T extends z.ZodTypeAny>(
  itemSchema: T,
): z.ZodType<Page<z.infer<T>>> {
  return z.object({
    count: z.number().nullable(),
    next: z.string().nullable(),
    previous: z.string().nullable(),
    results: z.array(itemSchema),
  });
}
