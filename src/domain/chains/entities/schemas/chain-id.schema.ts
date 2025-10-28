import { z } from 'zod';
import { CHAIN_ID_MAXLENGTH } from '@/routes/common/constants';

export const ChainIdSchema = z
  .string()
  .regex(/^\d+$/, {
    message: 'Chain ID must be a positive integer',
  })
  .refine((val) => val.length <= CHAIN_ID_MAXLENGTH, {
    message: `Value must be less than or equal to ${CHAIN_ID_MAXLENGTH}`,
  });
