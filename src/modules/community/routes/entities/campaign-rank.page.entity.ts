import { Page } from '@/routes/common/entities/page.entity';
import { CampaignRank } from '@/modules/community/routes/entities/campaign-rank.entity';
import { ApiProperty } from '@nestjs/swagger';

export class CampaignRankPage extends Page<CampaignRank> {
  @ApiProperty({ type: CampaignRank, isArray: true })
  results!: Array<CampaignRank>;
}
