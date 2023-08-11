import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TransactionInfo {
  @ApiProperty()
  type: string;
  @ApiPropertyOptional({ type: String, nullable: true })
  readableDescription?: string;

  protected constructor(type: string, readableDescription?: string) {
    this.type = type;
    this.readableDescription = readableDescription;
  }
}
