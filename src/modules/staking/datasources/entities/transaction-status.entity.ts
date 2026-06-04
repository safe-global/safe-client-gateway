// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { EventTopicsSchema } from '@/validation/entities/schemas/event-topics.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';

// Note: this is a partial schema for decoding `DepositEvent` logs
// of native staking `deposit` transactions.

export const TransactionStatusReceiptLogSchema = z.object({
  topics: EventTopicsSchema,
  data: HexSchema,
});

export const TransactionStatusReceiptSchema = z.object({
  logs: z.array(TransactionStatusReceiptLogSchema),
});

export const TransactionStatusSchema = z.object({
  receipt: TransactionStatusReceiptSchema,
});

export type TransactionStatus = z.infer<typeof TransactionStatusSchema>;
