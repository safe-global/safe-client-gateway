// SPDX-License-Identifier: FSL-1.1-MIT
import type { ClsService } from 'nestjs-cls';
import { UuidSchema } from '#/validation/entities/schemas/uuid.schema';

export const SAFE_HEADER_PREFIX = 'x-safe-';

export const SAFE_REQUEST_ID_HEADER = `${SAFE_HEADER_PREFIX}req-id`;

/**
 * Returns the `x-safe-req-id` header carrying the current request ID, the same
 * value logged as `request_id`.
 *
 * Empty outside of a request (jobs, crons, events) or if the ID is not a UUID.
 */
export function getSafeRequestIdHeaders(
  cls: ClsService,
): Record<string, string> {
  const result = UuidSchema.safeParse(cls.getId());
  return result.success ? { [SAFE_REQUEST_ID_HEADER]: result.data } : {};
}
