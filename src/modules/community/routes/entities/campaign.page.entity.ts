// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';
import { Campaign } from '@/modules/community/routes/entities/campaign.entity';
import { Page } from '@/routes/common/entities/page.entity';

export class CampaignPage extends Page<Campaign> {
  @ApiProperty({ type: Campaign, isArray: true })
  results!: Array<Campaign>;
}
