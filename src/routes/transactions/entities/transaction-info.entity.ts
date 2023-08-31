import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RichHumanDescriptionFragment } from '@/routes/transactions/entities/human-description.entity';

export class TransactionInfo {
  @ApiProperty()
  type: string;
  @ApiPropertyOptional({ type: String, nullable: true })
  humanDescription: RichHumanDescriptionFragment[] | null;

  protected constructor(
    type: string,
    humanDescription: RichHumanDescriptionFragment[] | null,
  ) {
    this.type = type;
    this.humanDescription = humanDescription;
  }
}
