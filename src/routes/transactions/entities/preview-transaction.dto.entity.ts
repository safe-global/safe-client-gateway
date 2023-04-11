import { ApiProperty } from '@nestjs/swagger';
import { Operation } from '../../../domain/safe/entities/operation.entity';
import { PreviewTransactionDto as DomainPreviewTransactionDto } from '../../../domain/transactions/entities/preview-transaction.entity';

export class PreviewTransactionDto implements DomainPreviewTransactionDto {
  @ApiProperty()
  to: string;
  @ApiProperty()
  data: string;
  @ApiProperty()
  value: string;
  @ApiProperty()
  operation: Operation;
}
