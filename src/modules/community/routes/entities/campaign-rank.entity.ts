import { ApiProperty } from '@nestjs/swagger';
import type { Address } from 'viem';
import type { CampaignRank as DomainCampaignRank } from '@/modules/community/domain/entities/campaign-rank.entity';

export class CampaignRank implements DomainCampaignRank {
  @ApiProperty()
  holder!: Address;
  @ApiProperty()
  position!: number;
  @ApiProperty()
  boost!: number;
  @ApiProperty()
  totalPoints!: number;
  @ApiProperty()
  totalBoostedPoints!: number;
}
