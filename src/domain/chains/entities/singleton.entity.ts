import { SingletonSchema } from '@/domain/chains/entities/schemas/singleton.schema';
import { z } from 'zod';

export type Singleton = z.infer<typeof SingletonSchema>;
