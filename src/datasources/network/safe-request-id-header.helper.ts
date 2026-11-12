// SPDX-License-Identifier: FSL-1.1-MIT
import type { ClsService } from 'nestjs-cls';
import { z } from 'zod';

export const SAFE_HEADER_PREFIX = 'x-safe-';

export const SAFE_REQUEST_ID_HEADER = `${SAFE_HEADER_PREFIX}req-id`;

const RequestIdSchema = z.string().regex(/^[0-9a-f]{32}$/);

/**
 * Returns the `x-safe-req-id` header carrying the current request ID, the same
 * value logged as `request_id`.
 *
 * Empty outside of a request (jobs, crons, events) or if the ID is not 32
 * lowercase hex characters.
 */
export function getSafeRequestIdHeaders(
  cls: ClsService,
): Record<string, string> {
  const result = RequestIdSchema.safeParse(cls.getId());
  return result.success ? { [SAFE_REQUEST_ID_HEADER]: result.data } : {};
}
