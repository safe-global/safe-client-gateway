import { z } from 'zod';

export const BackboneSchema = z.object({
  name: z.string(),
  version: z.string(),
  api_version: z.string(),
  secure: z.boolean(),
  host: z.string(),
  headers: z.array(z.string()).optional().nullable().default(null),
  settings: z.record(z.unknown()).optional().nullable().default(null),
});
