import type { SingletonSchema } from '@/modules/chains/domain/entities/schemas/singleton.schema';
import type { z } from 'zod';

export type Singleton = z.infer<typeof SingletonSchema>;
