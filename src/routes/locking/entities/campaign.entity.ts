import { Campaign as DomainCampaign } from '@/domain/locking/entities/campaign.entity';
import { ActivityMetadata } from '@/routes/locking/entities/activity-metadata.entity';
import { ApiProperty } from '@nestjs/swagger';

export class Campaign implements DomainCampaign {
  @ApiProperty()
  campaignId!: string;
  @ApiProperty()
  name!: string;
  @ApiProperty()
  description!: string;
  @ApiProperty({ type: String })
  periodStart!: Date;
  @ApiProperty({ type: String })
  periodEnd!: Date;
  @ApiProperty({ type: String })
  lastUpdated!: Date;
  @ApiProperty({ type: [ActivityMetadata] })
  activities!: ActivityMetadata[] | null;
}
