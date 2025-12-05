import type { Operation } from '@/modules/safe/domain/entities/operation.entity';
import type { GetEstimationDtoSchema } from '@/modules/estimations/routes/entities/schemas/get-estimation.dto.schema';
import type { z } from 'zod';
import type { Address, Hex } from 'viem';

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
