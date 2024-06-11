import { CampaignPoints as DomainCampaignPoints } from '@/domain/community/entities/campaign-points.entity';
import { ApiProperty } from '@nestjs/swagger';

export class CampaignPoints implements DomainCampaignPoints {
  @ApiProperty({ type: String })
  startDate!: Date;
  @ApiProperty({ type: String })
  endDate!: Date;
  @ApiProperty()
  boost!: number;
  @ApiProperty()
  totalPoints!: number;
  @ApiProperty()
  totalBoostedPoints!: number;
}
