// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';

const RelayTaskStatusReceiptSchema = z
  .object({
    blockHash: z.string().optional(),
    blockNumber: z.string().optional(),
    gasUsed: z.string().optional(),
    transactionHash: z.string(),
  })
  .optional();

export const RelayTaskStatusSchema = z.object({
  chainId: z.string(),
  createdAt: z.number().optional(),
  id: z.string(),
  status: z.number(),
  receipt: RelayTaskStatusReceiptSchema,
});

export type RelayTaskStatus = z.infer<typeof RelayTaskStatusSchema>;

export const RhinestoneTaskStatusResponseSchema = z.object({
  taskId: z.string(),
  status: z.number(),
  transactionHash: HexSchema.optional(),
});

export type RhinestoneTaskStatusResponse = z.infer<
  typeof RhinestoneTaskStatusResponseSchema
>;
