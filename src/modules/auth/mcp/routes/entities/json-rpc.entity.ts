// SPDX-License-Identifier: FSL-1.1-MIT

import { z } from 'zod';

// https://www.jsonrpc.org/specification#request_object
export const JsonRpcMessageSchema = z.object({
  jsonrpc: z.literal('2.0'),
  // Absent on notifications, which get no response.
  id: z.union([z.string(), z.number().int()]).optional(),
  method: z.string(),
  params: z.record(z.string(), z.unknown()).optional(),
});

export type JsonRpcMessage = z.infer<typeof JsonRpcMessageSchema>;

export type JsonRpcResponse =
  | { jsonrpc: '2.0'; id: string | number; result: unknown }
  | {
      jsonrpc: '2.0';
      id: string | number;
      error: { code: number; message: string };
    };

// https://www.jsonrpc.org/specification#error_object
export const JsonRpcErrorCode = {
  MethodNotFound: -32601,
  InvalidParams: -32602,
} as const;
