// SPDX-License-Identifier: FSL-1.1-MIT
import type { z } from 'zod';
import type { GasTokenSchema } from '@/modules/fees/domain/entities/schemas/gas-token.schema';

export type GasToken = z.infer<typeof GasTokenSchema>;
