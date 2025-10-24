import { z } from 'zod';

/**
 * Schema for validating comma-separated chain IDs query parameter.
 * Transforms string like "1,10,137" into array of validated chain ID strings.
 * Filters out empty strings and validates each ID is numeric.
 */
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
