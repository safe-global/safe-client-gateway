// SPDX-License-Identifier: FSL-1.1-MIT
import type { CanRelayResponseSchema } from '@/modules/fees/domain/entities/schemas/can-relay-response.schema';
import type { z } from 'zod';

export type CanRelayResponse = z.infer<typeof CanRelayResponseSchema>;
