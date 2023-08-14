import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TransactionInfo {
  @ApiProperty()
  type: string;
  @ApiPropertyOptional({ type: String, nullable: true })
  humanDescription?: string;

  protected constructor(type: string, humanDescription?: string) {
    this.type = type;
    this.humanDescription = humanDescription;
  }
}
