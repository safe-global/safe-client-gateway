import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';
import { CHAIN_ID_MAXLENGTH } from '@/routes/common/constants';

export const ChainIdSchema = NumericStringSchema.refine(
  (val) => val.length <= CHAIN_ID_MAXLENGTH,
  {
    message: `Value must be less than or euqal to ${CHAIN_ID_MAXLENGTH}`,
  },
);
