import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Operation } from '@/domain/safe/entities/operation.entity';
import { z } from 'zod';
import { PreviewTransactionDtoSchema } from '@/routes/transactions/entities/schemas/preview-transaction.dto.schema';

export class PreviewTransactionDto
  implements z.infer<typeof PreviewTransactionDtoSchema>
{
  @ApiProperty()
  to!: `0x${string}`;
  @ApiPropertyOptional({ type: String, nullable: true })
  data!: `0x${string}` | null;
  @ApiProperty()
  value!: string;
  @ApiProperty()
  operation!: Operation;
}
