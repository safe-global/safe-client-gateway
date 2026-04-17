// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address, Hex } from 'viem';
import type { z } from 'zod';
import type { GetEstimationDtoSchema } from '@/modules/estimations/routes/entities/schemas/get-estimation.dto.schema';
import type { Operation } from '@/modules/safe/domain/entities/operation.entity';

export class GetEstimationDto implements z.infer<
  typeof GetEstimationDtoSchema
> {
  to: Address;
  value: string;
  data: Hex | null;
  operation: Operation;

  constructor(
    to: Address,
    value: string,
    data: Hex | null,
    operation: Operation,
  ) {
    this.to = to;
    this.value = value;
    this.data = data;
    this.operation = operation;
  }
}
