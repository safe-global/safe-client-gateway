import { ApiProperty } from '@nestjs/swagger';
import type { z } from 'zod';
import type { DeleteTransactionDtoSchema } from '@/modules/transactions/routes/entities/schemas/delete-transaction.dto.schema';

export class DeleteTransactionDto implements z.infer<
  typeof DeleteTransactionDtoSchema
> {
  @ApiProperty()
  signature!: string;
}
