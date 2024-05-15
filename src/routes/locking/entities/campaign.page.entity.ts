import { Page } from '@/routes/common/entities/page.entity';
import { Campaign } from '@/routes/locking/entities/campaign.entity';
import { ApiProperty } from '@nestjs/swagger';

export class CampaignPage extends Page<Campaign> {
  @ApiProperty({ type: [Campaign] })
  results!: Array<Campaign>;
}
