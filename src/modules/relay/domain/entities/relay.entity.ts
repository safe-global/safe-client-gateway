import { z } from 'zod';

export const GelatoRelayResponseSchema = z.object({
  jsonrpc: z.literal('2.0'),
  result: z.string(),
  id: z.number(),
});

export const RelaySchema = z.object({
  taskId: z.string(),
});

export type Relay = z.infer<typeof RelaySchema>;
