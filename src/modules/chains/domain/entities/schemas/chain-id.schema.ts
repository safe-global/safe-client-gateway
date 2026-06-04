// SPDX-License-Identifier: FSL-1.1-MIT
import { CHAIN_ID_MAXLENGTH } from '@/routes/common/constants';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';

export const ChainIdSchema = NumericStringSchema.refine(
  (val) => val.length <= CHAIN_ID_MAXLENGTH,
  {
    message: `Value must be less than or euqal to ${CHAIN_ID_MAXLENGTH}`,
  },
);
