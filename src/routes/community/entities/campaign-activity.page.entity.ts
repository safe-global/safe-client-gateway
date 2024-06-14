import { Page } from '@/routes/common/entities/page.entity';
import { CampaignActivity } from '@/routes/community/entities/campaign-activity.entity';
import { ApiProperty } from '@nestjs/swagger';

export class CampaignActivityPage extends Page<CampaignActivity> {
  @ApiProperty({ type: [CampaignActivity] })
  results!: Array<CampaignActivity>;
}
