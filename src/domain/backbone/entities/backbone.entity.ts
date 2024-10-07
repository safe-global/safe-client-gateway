import type { BackboneSchema } from '@/domain/backbone/entities/schemas/backbone.schema';
import type { z } from 'zod';

export type Backbone = z.infer<typeof BackboneSchema>;
