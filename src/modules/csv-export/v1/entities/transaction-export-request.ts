import { ApiProperty } from '@nestjs/swagger';

export class TransactionExportDto {
  @ApiProperty({
    required: false,
    description: 'Execution date greater than or equal to (ISO date string)',
  })
  executionDateGte?: string;

  @ApiProperty({
    required: false,
    description: 'Execution date less than or equal to (ISO date string)',
  })
  executionDateLte?: string;

  @ApiProperty({
    required: false,
    description: 'Maximum number of transactions to export',
  })
  limit?: number;

  @ApiProperty({
    required: false,
    description: 'Number of transactions to skip',
  })
  offset?: number;
}
