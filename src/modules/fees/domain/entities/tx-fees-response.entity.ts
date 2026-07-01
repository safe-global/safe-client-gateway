// SPDX-License-Identifier: FSL-1.1-MIT

import type { z } from 'zod';
import type {
  RelayCostSchema,
  TxDataResponseSchema,
  TxFeesResponseSchema,
} from '@/modules/fees/domain/entities/schemas/tx-fees-response.schema';

export type TxDataResponse = z.infer<typeof TxDataResponseSchema>;

export type RelayCost = z.infer<typeof RelayCostSchema>;

export type TxFeesResponse = z.infer<typeof TxFeesResponseSchema>;
