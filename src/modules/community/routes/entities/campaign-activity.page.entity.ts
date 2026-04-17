import { ApiProperty } from '@nestjs/swagger';
import { CampaignActivity } from '@/modules/community/routes/entities/campaign-activity.entity';
import { Page } from '@/routes/common/entities/page.entity';

export class CampaignActivityPage extends Page<CampaignActivity> {
  @ApiProperty({ type: CampaignActivity, isArray: true })
  results!: Array<CampaignActivity>;
}
