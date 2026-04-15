// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';

export const CanRelayResponseSchema = z.object({
  canRelay: z.boolean(),
});
