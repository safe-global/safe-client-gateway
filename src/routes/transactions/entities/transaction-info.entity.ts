import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TransactionInfo {
  @ApiProperty()
  type: string;
  @ApiPropertyOptional({ type: String, nullable: true })
  humanDescription: string | null;

  protected constructor(type: string, humanDescription: string | null) {
    this.type = type;
    this.humanDescription = humanDescription;
  }
}
