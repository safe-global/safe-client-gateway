import { Page } from '@/routes/common/entities/page.entity';
import { CampaignRank } from '@/routes/community/entities/campaign-rank.entity';
import { ApiProperty } from '@nestjs/swagger';

export class CampaignRankPage extends Page<CampaignRank> {
  @ApiProperty({ type: CampaignRank })
  results!: Array<CampaignRank>;
}
