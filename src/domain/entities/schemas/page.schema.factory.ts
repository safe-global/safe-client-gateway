import { z } from 'zod';
import type { Page } from '@/domain/entities/page.entity';

const BasePageSchema = z.object({
  count: z.number().nullable(),
  next: z.string().nullable(),
  previous: z.string().nullable(),
});

export function buildPageSchema<T extends z.ZodTypeAny>(
  itemSchema: T,
): z.ZodType<Page<z.infer<T>>> {
  return BasePageSchema.extend({ results: z.array(itemSchema) });
}

/**
 * Builds a lenient page schema that filters out invalid items from
 * the results array, setting the length of which as the count.
 */
export function buildLenientPageSchema<T extends z.ZodTypeAny>(
  itemSchema: T,
): z.ZodType<Page<z.infer<T>>> {
  return BasePageSchema.extend({
    results: z.array(z.any()),
  }).transform((data) => {
    const results = data.results.flatMap((item) => {
      const result = itemSchema.safeParse(item);
      return result.success ? [result.data] : [];
    });

    return {
      ...data,
      count: results.length,
      results,
    };
  });
}
