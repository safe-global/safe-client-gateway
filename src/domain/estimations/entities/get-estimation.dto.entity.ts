import type { Operation } from '@/domain/safe/entities/operation.entity';
import type { GetEstimationDtoSchema } from '@/routes/estimations/entities/schemas/get-estimation.dto.schema';
import type { z } from 'zod';

export class GetEstimationDto
  implements z.infer<typeof GetEstimationDtoSchema>
{
  to: `0x${string}`;
  value: string;
  data: `0x${string}` | null;
  operation: Operation;

  constructor(
    to: `0x${string}`,
    value: string,
    data: `0x${string}` | null,
    operation: Operation,
  ) {
    this.to = to;
    this.value = value;
    this.data = data;
    this.operation = operation;
  }
}
