import { getAddress } from 'viem';
import { z } from 'zod';

export const AddressSchema = z.string().transform((value, ctx) => {
  try {
    return getAddress(value);
  } catch {
    ctx.addIssue({
      code: 'custom',
      message: 'Invalid address',
    });
    return z.NEVER;
  }
});
