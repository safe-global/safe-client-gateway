import { ContractSchema } from '@/domain/contracts/entities/schemas/contract.schema';
import { z } from 'zod';

export type Contract = z.infer<typeof ContractSchema>;
