import { z } from 'zod';

export const ChainIdsSchema = z
  .string()
  .optional()
  .transform((val) => {
    if (!val) return undefined;
    return val
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0);
  })
  .pipe(
    z
      .array(
        z.string().regex(/^\d+$/, {
          message: 'Chain IDs must be numeric strings',
        }),
      )
      .optional(),
  );

export type ChainIds = z.infer<typeof ChainIdsSchema>;
