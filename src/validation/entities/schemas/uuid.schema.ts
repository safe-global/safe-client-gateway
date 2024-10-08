import type { UUID } from 'crypto';
import { z } from 'zod';

export const UuidSchema = z
  .string()
  .uuid({
    message: 'Invalid UUID',
  })
  // Return type of uuid is string so we need to cast it
  .transform((uuid) => {
    return uuid as UUID;
  });
