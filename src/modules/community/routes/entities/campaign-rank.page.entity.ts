import { ApiProperty } from '@nestjs/swagger';
import { CampaignRank } from '@/modules/community/routes/entities/campaign-rank.entity';
import { Page } from '@/routes/common/entities/page.entity';

export class CampaignRankPage extends Page<CampaignRank> {
  @ApiProperty({ type: CampaignRank, isArray: true })
  results!: Array<CampaignRank>;
}
