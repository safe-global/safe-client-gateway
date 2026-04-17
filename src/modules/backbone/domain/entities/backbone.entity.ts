import type { z } from 'zod';
import type { BackboneSchema } from '@/modules/backbone/domain/entities/schemas/backbone.schema';

export type Backbone = z.infer<typeof BackboneSchema>;
