// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Operation } from '@/modules/safe/domain/entities/operation.entity';
import type { z } from 'zod';
import type { PreviewTransactionDtoSchema } from '@/modules/transactions/routes/entities/schemas/preview-transaction.dto.schema';
import type { Address, Hex } from 'viem';

export class PreviewTransactionDto implements z.infer<
  typeof PreviewTransactionDtoSchema
> {
  @ApiProperty()
  to!: Address;
  @ApiPropertyOptional({ type: String, nullable: true })
  data!: Hex | null;
  @ApiProperty()
  value!: string;
  @ApiProperty({
    enum: Operation,
    enumName: 'Operation',
    description: 'Operation type: 0 for CALL, 1 for DELEGATE',
  })
  operation!: Operation;
}
