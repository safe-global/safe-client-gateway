import { Page } from '@/routes/common/entities/page.entity';
import { Campaign } from '@/routes/community/entities/campaign.entity';
import { ApiProperty } from '@nestjs/swagger';

export class CampaignPage extends Page<Campaign> {
  @ApiProperty({ type: Campaign, isArray: true })
  results!: Array<Campaign>;
}
