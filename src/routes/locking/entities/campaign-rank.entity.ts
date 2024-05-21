import { CampaignRank as DomainCampaignRank } from '@/domain/community/entities/campaign-rank.entity';
import { ApiProperty } from '@nestjs/swagger';

export class CampaignRank implements DomainCampaignRank {
  @ApiProperty()
  holder!: `0x${string}`;
  @ApiProperty()
  position!: number;
  @ApiProperty()
  boost!: number;
  @ApiProperty()
  points!: number;
  @ApiProperty()
  boostedPoints!: number;
}
