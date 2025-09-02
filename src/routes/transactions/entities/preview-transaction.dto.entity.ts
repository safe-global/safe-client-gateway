import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Operation } from '@/domain/safe/entities/operation.entity';
import { z } from 'zod';
import { PreviewTransactionDtoSchema } from '@/routes/transactions/entities/schemas/preview-transaction.dto.schema';
import type { Address, Hex } from 'viem';

export class PreviewTransactionDto
  implements z.infer<typeof PreviewTransactionDtoSchema>
{
  @ApiProperty()
  to!: Address;
  @ApiPropertyOptional({ type: String, nullable: true })
  data!: Hex | null;
  @ApiProperty()
  value!: string;
  @ApiProperty()
  operation!: Operation;
}
