// SPDX-License-Identifier: FSL-1.1-MIT
import type { DeleteTransactionDtoSchema } from '@/modules/transactions/routes/entities/schemas/delete-transaction.dto.schema';
import { ApiProperty } from '@nestjs/swagger';
import type { z } from 'zod';

export class DeleteTransactionDto implements z.infer<
  typeof DeleteTransactionDtoSchema
> {
  @ApiProperty()
  signature!: string;
}
