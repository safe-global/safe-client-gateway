import type { DelegateSchema } from '@/modules/delegate/domain/entities/schemas/delegate.schema';
import type { z } from 'zod';

export type Delegate = z.infer<typeof DelegateSchema>;
