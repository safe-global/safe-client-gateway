// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';
import type { Address, Hex } from 'viem';
import type { z } from 'zod';
import { Origin } from '@/modules/fees/domain/entities/origin.entity';
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

  @ApiProperty({
    description: 'Safe nonce the transaction will use (uint256 string)',
    example: '42',
  })
  nonce: string;

  @ApiProperty({
    enum: Origin,
    enumName: 'Origin',
    description: 'Transaction origin. Defaults to NATIVE when omitted.',
    required: false,
  })
  origin?: Origin;

  @ApiProperty({
    description:
      'Fiat currency code for relay cost conversion (e.g. EUR, GBP). Defaults to USD.',
    example: 'EUR',
    required: false,
  })
  fiatCode?: string;

  constructor(dto: z.infer<typeof FeePreviewTransactionDtoSchema>) {
    this.to = dto.to;
    this.value = dto.value;
    this.data = dto.data;
    this.operation = dto.operation;
    this.gasToken = dto.gasToken;
    this.numberSignatures = dto.numberSignatures;
    this.nonce = dto.nonce;
    this.origin = dto.origin;
    this.fiatCode = dto.fiatCode;
  }
}
