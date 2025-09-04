import { CampaignActivity as DomainCampaignActivity } from '@/domain/community/entities/campaign-activity.entity';
import { ApiProperty } from '@nestjs/swagger';
import type { Address } from 'viem';

export class CampaignActivity implements DomainCampaignActivity {
  @ApiProperty()
  holder!: Address;
  @ApiProperty({ type: String })
  startDate!: Date;
  @ApiProperty({ type: String })
  endDate!: Date;
  @ApiProperty()
  boost!: string;
  @ApiProperty()
  totalPoints!: string;
  @ApiProperty()
  totalBoostedPoints!: string;
}
