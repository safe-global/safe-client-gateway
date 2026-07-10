// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';

export const RhinestoneRelayResponseSchema = z.object({
  taskId: z.string(),
});

export type RhinestoneRelayResponse = z.infer<
  typeof RhinestoneRelayResponseSchema
>;

export const RelaySchema = z.object({
  taskId: z.string(),
});

export type Relay = z.infer<typeof RelaySchema>;
