import { z } from 'zod';
import { asError } from '@/logging/utils';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';

export const Caip10AddressesSchema = z.string().transform((str, ctx) => {
  return str.split(',').map((item) => {
    try {
      const [chainId, address] = item.split(':');
      return z
        .object({
          chainId: NumericStringSchema,
          address: AddressSchema,
        })
        .parse({ chainId, address });
    } catch (e) {
      if (e instanceof z.ZodError) {
        e.issues.forEach((issue) => {
          ctx.addIssue(issue);
        });
      } else {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: asError(e).message,
        });
      }
      return z.NEVER;
    }
  });
});

export type Caip10Addresses = z.infer<typeof Caip10AddressesSchema>;
