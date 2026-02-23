// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';

export const RelaySchema = z.object({
  taskId: z.string(),
});

export type Relay = z.infer<typeof RelaySchema>;
