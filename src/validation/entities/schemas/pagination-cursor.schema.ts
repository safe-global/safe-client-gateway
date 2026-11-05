// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { PaginationData } from '#/routes/common/pagination/pagination.data';
import { NonNegativeNumericStringSchema } from '#/validation/entities/schemas/non-negative-numeric-string.schema';

const CursorValueSchema = NonNegativeNumericStringSchema.transform(Number)
  .refine(Number.isSafeInteger, { error: 'Invalid cursor value' })
  .optional();

/**
 * The `cursor` query parameter (`limit=<n>&offset=<n>`) as {@link PaginationData}.
 * A missing cursor, or a missing key in it, takes the default value.
 */
export const PaginationCursorSchema = z
  .string()
  .optional()
  .transform((cursor) => {
    // The first value of a repeated key, as `PaginationData.fromCursor` reads it for the page links.
    const params = new URLSearchParams(cursor);
    return Object.fromEntries(
      ['limit', 'offset'].flatMap((key) => {
        const value = params.get(key);
        return value === null ? [] : [[key, value]];
      }),
    );
  })
  .pipe(z.object({ limit: CursorValueSchema, offset: CursorValueSchema }))
  .transform(
    ({ limit, offset }) =>
      new PaginationData(
        limit ?? PaginationData.DEFAULT_LIMIT,
        offset ?? PaginationData.DEFAULT_OFFSET,
      ),
  );
