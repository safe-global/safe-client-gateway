// SPDX-License-Identifier: FSL-1.1-MIT
import { TransactionBaseSchema } from '#/domain/common/schemas/transaction-base.schema';
import { NullableHexSchema } from '#/validation/entities/schemas/nullable.schema';

export const GetEstimationDtoSchema = TransactionBaseSchema.extend({
  data: NullableHexSchema,
});
