import { z } from 'zod';
import { getAddress } from 'viem';

export const AddressSchema = z.string().transform((value, ctx) => {
  try {
    return getAddress(value);
  } catch (e) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Invalid address',
    });
    return z.NEVER;
  }
});
