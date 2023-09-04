import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RichInfo } from '@/routes/transactions/entities/human-description.entity';

export class TransactionInfo {
  @ApiProperty()
  type: string;
  @ApiPropertyOptional({ type: String, nullable: true })
  humanDescription: string | null;
  @ApiPropertyOptional({ type: Object, nullable: true })
  richInfo: RichInfo | null;

  protected constructor(
    type: string,
    humanDescription: string | null,
    richInfo: RichInfo | null,
  ) {
    this.type = type;
    this.humanDescription = humanDescription;
    this.richInfo = richInfo;
  }
}
