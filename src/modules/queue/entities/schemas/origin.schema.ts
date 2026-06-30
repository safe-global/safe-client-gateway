// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';

const MAX_ORIGIN_NAME_LENGTH = 256;
const MAX_ORIGIN_URL_LENGTH = 2048;
const ALLOWED_ORIGIN_URL_PROTOCOLS = new Set(['https:']);

export const OriginNameSchema = z
  .string()
  .max(MAX_ORIGIN_NAME_LENGTH)
  .nullish()
  .default(null)
  .catch(null);

// z.url() in zod 4 hands invalid inputs to chained refines rather than rejecting
// upfront, so the refine has to guard `new URL()` itself; otherwise the throw
// escapes `.catch(null)` and a single bad row poisons the whole batch.
export const OriginUrlSchema = z
  .url()
  .max(MAX_ORIGIN_URL_LENGTH)
  .refine(
    (value) => {
      try {
        return ALLOWED_ORIGIN_URL_PROTOCOLS.has(new URL(value).protocol);
      } catch {
        return false;
      }
    },
    { message: 'Invalid origin URL protocol' },
  )
  .nullish()
  .default(null)
  .catch(null);
