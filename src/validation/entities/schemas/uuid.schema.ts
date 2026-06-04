// SPDX-License-Identifier: FSL-1.1-MIT
import type { UUID } from 'node:crypto';
import { z } from 'zod';

export const UuidSchema = z
  .uuid({
    error: 'Invalid UUID',
  })
  // Return type of uuid is string so we need to cast it
  .transform((uuid) => {
    return uuid as UUID;
  });
