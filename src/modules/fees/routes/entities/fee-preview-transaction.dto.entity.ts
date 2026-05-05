// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';
import type { Address, Hex } from 'viem';
import type { z } from 'zod';
import type { FeePreviewTransactionDtoSchema } from '@/modules/fees/routes/entities/schemas/fee-preview-transaction.dto.schema';
import { Operation } from '@/modules/safe/domain/entities/operation.entity';

export class FeePreviewTransactionDto
  implements z.infer<typeof FeePreviewTransactionDtoSchema>
{
  @ApiProperty()
  to: Address;

  @ApiProperty()
  value: string;

  @ApiProperty()
  data: Hex;

  @ApiProperty({
    enum: Operation,
    enumName: 'Operation',
    description: 'Operation type: 0 for CALL, 1 for DELEGATE',
  })
  operation: Operation;

  @ApiProperty({
    description: 'Gas token address (0x0...0 for native token)',
    example: '0x0000000000000000000000000000000000000000',
  })
  gasToken: Address;

  @ApiProperty({
    description: 'Number of signatures required for execution',
    example: 2,
    minimum: 1,
  })
  numberSignatures: number;

  constructor(dto: z.infer<typeof FeePreviewTransactionDtoSchema>) {
    this.to = dto.to;
    this.value = dto.value;
    this.data = dto.data;
    this.operation = dto.operation;
    this.gasToken = dto.gasToken;
    this.numberSignatures = dto.numberSignatures;
  }
}
