import { BackboneSchema } from '@/domain/backbone/entities/schemas/backbone.schema';
import { z } from 'zod';

export type Backbone = z.infer<typeof BackboneSchema>;
