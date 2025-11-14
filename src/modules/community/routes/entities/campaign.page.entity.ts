import { Page } from '@/routes/common/entities/page.entity';
import { Campaign } from '@/modules/community/routes/entities/campaign.entity';
import { ApiProperty } from '@nestjs/swagger';

export class CampaignPage extends Page<Campaign> {
  @ApiProperty({ type: Campaign, isArray: true })
  results!: Array<Campaign>;
}
