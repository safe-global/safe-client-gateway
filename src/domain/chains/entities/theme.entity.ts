import { ThemeSchema } from '@/domain/chains/entities/schemas/chain.schema';
import { z } from 'zod';

export type Theme = z.infer<typeof ThemeSchema>;
