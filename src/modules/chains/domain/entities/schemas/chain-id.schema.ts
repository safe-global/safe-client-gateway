// SPDX-License-Identifier: FSL-1.1-MIT
import { CHAIN_ID_MAXLENGTH } from '#/routes/common/constants';
import { NumericStringSchema } from '#/validation/entities/schemas/numeric-string.schema';

export const ChainIdSchema = NumericStringSchema.refine(
  (val) => /^\d+$/.test(val),
  {
    message: 'Value must be a non-negative integer',
    // A value that is not numeric at all keeps its single numeric-string issue.
    when: (payload) => payload.issues.length === 0,
  },
).refine((val) => val.length <= CHAIN_ID_MAXLENGTH, {
  message: `Value must be at most ${CHAIN_ID_MAXLENGTH} characters long`,
});
