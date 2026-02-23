// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';

export const GelatoRelayResponseSchema = z.object({
  jsonrpc: z.literal('2.0'),
  result: z.string(),
  id: z.number(),
});

export type GelatoRelayResponse = z.infer<typeof GelatoRelayResponseSchema>;

export const RelaySchema = z.object({
  taskId: z.string(),
});

export type Relay = z.infer<typeof RelaySchema>;
