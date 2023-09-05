import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RichDecodedInfo } from '@/routes/transactions/entities/human-description.entity';

export class TransactionInfo {
  @ApiProperty()
  type: string;
  @ApiPropertyOptional({ type: String, nullable: true })
  humanDescription: string | null;
  // TODO: Remove nullable once the feature flag is removed, allow returning an empty array instead
  @ApiPropertyOptional({ type: RichDecodedInfo, nullable: true })
  richDecodedInfo: RichDecodedInfo | null;

  protected constructor(
    type: string,
    humanDescription: string | null,
    richDecodedInfo: RichDecodedInfo | null,
  ) {
    this.type = type;
    this.humanDescription = humanDescription;
    this.richDecodedInfo = richDecodedInfo;
  }
}
