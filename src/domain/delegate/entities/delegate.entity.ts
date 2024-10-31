import type { DelegateSchema } from '@/domain/delegate/entities/schemas/delegate.schema';
import type { z } from 'zod';

export type Delegate = z.infer<typeof DelegateSchema>;
