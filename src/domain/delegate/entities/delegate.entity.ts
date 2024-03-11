import { DelegateSchema } from '@/domain/delegate/entities/schemas/delegate.schema';
import { z } from 'zod';

export type Delegate = z.infer<typeof DelegateSchema>;
