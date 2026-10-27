// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { CHAIN_ID_MAXLENGTH } from '#/routes/common/constants';

export const ChainIdSchema = z
  .string()
  .refine((val) => /^\d+$/.test(val), {
    error: 'Invalid base-10 numeric string',
  })
  .refine((val) => val.length <= CHAIN_ID_MAXLENGTH, {
    message: `Value must be at most ${CHAIN_ID_MAXLENGTH} characters long`,
  });
