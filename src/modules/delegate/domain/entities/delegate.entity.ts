import type { z } from 'zod';
import type { DelegateSchema } from '@/modules/delegate/domain/entities/schemas/delegate.schema';

export type Delegate = z.infer<typeof DelegateSchema>;
