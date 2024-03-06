import { DeleteTransactionDtoSchema } from '@/routes/transactions/entities/schemas/delete-transaction.dto.schema';
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export class DeleteTransactionDto
  implements z.infer<typeof DeleteTransactionDtoSchema>
{
  @ApiProperty()
  signature!: string;
}
