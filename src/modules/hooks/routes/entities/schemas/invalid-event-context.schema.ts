// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';

export const InvalidEventContextSchema = z
  .object({
    type: z.string().optional().catch(undefined),
    chainId: z.string().optional().catch(undefined),
  })
  .catch({});
