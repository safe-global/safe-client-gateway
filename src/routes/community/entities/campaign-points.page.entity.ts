import { Page } from '@/routes/common/entities/page.entity';
import { CampaignPoints } from '@/routes/community/entities/campaign-points.entity';
import { ApiProperty } from '@nestjs/swagger';

export class CampaignPointsPage extends Page<CampaignPoints> {
  @ApiProperty({ type: [CampaignPoints] })
  results!: Array<CampaignPoints>;
}
