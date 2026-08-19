// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { OPAQUE_ID_MAXLENGTH } from '@/routes/common/constants';

/**
 * An opaque identifier minted by an upstream provider — a relay task id, a
 * billing plan/session id — whose internal structure we deliberately do not
 * model, since the provider is free to change it.
 *
 * Constrained to characters that cannot alter a URL, because these ids are
 * interpolated into upstream request paths. That rules out `/`, `?`, `#`, `.`
 * and whitespace, so a caller cannot use one to traverse or inject.
 */
export const OpaqueIdSchema = z
  .string()
  .min(1)
  .max(OPAQUE_ID_MAXLENGTH)
  .regex(/^[A-Za-z0-9_-]+$/);
