import { CampaignActivity as DomainCampaignActivity } from '@/domain/community/entities/campaign-activity.entity';
import { ApiProperty } from '@nestjs/swagger';

export class CampaignActivity implements DomainCampaignActivity {
  @ApiProperty()
  holder!: `0x${string}`;
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
