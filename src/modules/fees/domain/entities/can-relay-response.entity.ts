// SPDX-License-Identifier: FSL-1.1-MIT

import type { z } from 'zod';
import type { CanRelayResponseSchema } from '@/modules/fees/domain/entities/schemas/can-relay-response.schema';

export type CanRelayResponse = z.infer<typeof CanRelayResponseSchema>;
