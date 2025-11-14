import type { BackboneSchema } from '@/modules/backbone/domain/entities/schemas/backbone.schema';
import type { z } from 'zod';

export type Backbone = z.infer<typeof BackboneSchema>;
