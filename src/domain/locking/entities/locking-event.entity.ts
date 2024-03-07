import { LockingEventSchema } from '@/domain/locking/entities/schemas/locking-event.schema';
import { z } from 'zod';

export type LockingEvent = z.infer<typeof LockingEventSchema>;
