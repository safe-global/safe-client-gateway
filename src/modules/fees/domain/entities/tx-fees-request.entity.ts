// SPDX-License-Identifier: FSL-1.1-MIT

import type { z } from 'zod';
import type { TxFeesRequestSchema } from '@/modules/fees/domain/entities/schemas/tx-fees-request.schema';

export type TxFeesRequest = z.infer<typeof TxFeesRequestSchema>;
