// SPDX-License-Identifier: FSL-1.1-MIT
import type { z } from 'zod';
import type { ContractSchema } from '@/modules/contracts/domain/entities/schemas/contract.schema';

export type Contract = z.infer<typeof ContractSchema>;
