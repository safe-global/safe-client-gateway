// SPDX-License-Identifier: FSL-1.1-MIT
import type { UUID } from 'node:crypto';
import { z } from 'zod';
import { UUID_REGEX } from '@/domain/common/constants';

/**
 * A guard runs before `SpaceIdPipe`, so anything the pipe would reject
 * resolves to `undefined` and is left to it. Deliberately the pipe's own
 * `UUID_REGEX`: an id it accepts but this rejected would reach the handler
 * ungated.
 */
export const SpaceIdParamSchema = z.object({
  spaceId: z
    .string()
    .regex(UUID_REGEX)
    .optional()
    .catch(undefined)
    // Shape-validated above; the cast only narrows, as `SpaceIdPipe` does.
    .transform((uuid) => uuid as UUID | undefined),
});
