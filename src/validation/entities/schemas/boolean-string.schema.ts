// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';

// Query strings carry booleans as text, so only the literal 'true' and 'false' are accepted.
export const BooleanStringSchema = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true');
