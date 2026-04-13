// SPDX-License-Identifier: FSL-1.1-MIT
import type { UUID } from 'crypto';
import { z } from 'zod';

export const UuidSchema = z
  .uuid({
    error: 'Invalid UUID',
  })
  // PG returns lowercase UUIDs; normalize to match and avoid case-mismatch bugs
  .transform((uuid) => {
    return uuid.toLowerCase() as UUID;
  });
