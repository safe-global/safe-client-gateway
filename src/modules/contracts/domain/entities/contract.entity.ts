import type { ContractSchema } from '@/modules/contracts/domain/entities/schemas/contract.schema';
import type { z } from 'zod';

export type Contract = z.infer<typeof ContractSchema>;
