import { z } from 'zod';

export type FullAppData = z.infer<typeof FullAppDataSchema>;

export const FullAppDataSchema = z.object({
  fullAppData: z
    .string()
    .nullish()
    .default(null)
    .transform((jsonString, ctx) => {
      try {
        if (!jsonString) return null;
        return JSON.parse(jsonString);
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Not a valid JSON payload',
        });
        return z.NEVER;
      }
    }),
});
