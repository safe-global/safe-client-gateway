import { SchemaObject } from 'ajv';
import { z } from 'zod';
import { Page } from '@/domain/entities/page.entity';

export function buildPageSchema(
  keyRef: string,
  itemSchema: SchemaObject,
): SchemaObject {
  return {
    $id: keyRef,
    type: 'object',
    properties: {
      count: { type: 'number' },
      next: { type: 'string', nullable: true },
      previous: { type: 'string', nullable: true },
      results: { type: 'array', items: { $ref: itemSchema.$id } },
    },
  };
}

// TODO: Delete above and rename below to buildPageSchema when fully migrated to zod
export function buildZodPageSchema<T extends z.ZodTypeAny>(
  itemSchema: T,
): z.ZodType<Page<z.infer<T>>> {
  return z.object({
    count: z.number().nullable(),
    next: z.string().nullable(),
    previous: z.string().nullable(),
    results: z.array(itemSchema),
  });
}
