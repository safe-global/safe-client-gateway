// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';

const LogSchema = z.object({
  raw: z
    .object({
      topics: z.array(z.string()).default([]),
    })
    .optional(),
});

export const TenderlySimulationResponseSchema = z.object({
  transaction: z.object({
    status: z.boolean(),
    error_message: z.string().optional(),
    transaction_info: z
      .object({
        logs: z.array(LogSchema).nullish(),
      })
      .optional(),
  }),
});

export type TenderlySimulationResponse = z.infer<
  typeof TenderlySimulationResponseSchema
>;
