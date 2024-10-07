import type { ContractSchema } from '@/domain/contracts/entities/schemas/contract.schema';
import type { z } from 'zod';

export type Contract = z.infer<typeof ContractSchema>;
