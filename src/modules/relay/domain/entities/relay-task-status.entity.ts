// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';

const RelayTaskStatusReceiptSchema = z
  .object({
    blockHash: z.string(),
    blockNumber: z.string(),
    gasUsed: z.string(),
    transactionHash: z.string(),
  })
  .optional();

export const RelayTaskStatusSchema = z.object({
  chainId: z.string(),
  createdAt: z.number(),
  id: z.string(),
  status: z.number(),
  receipt: RelayTaskStatusReceiptSchema,
});

export type RelayTaskStatus = z.infer<typeof RelayTaskStatusSchema>;

export const GelatoTaskStatusResponseSchema = z.object({
  jsonrpc: z.literal('2.0'),
  result: RelayTaskStatusSchema,
  id: z.number(),
});

export type GelatoTaskStatusResponse = z.infer<
  typeof GelatoTaskStatusResponseSchema
>;
