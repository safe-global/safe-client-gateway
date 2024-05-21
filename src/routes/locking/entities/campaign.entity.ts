import { Campaign as DomainCampaign } from '@/domain/community/entities/campaign.entity';
import { ActivityMetadata } from '@/routes/locking/entities/activity-metadata.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class Campaign implements DomainCampaign {
  @ApiProperty()
  resourceId!: string;
  @ApiProperty()
  name!: string;
  @ApiProperty()
  description!: string;
  @ApiProperty({ type: String })
  startDate!: Date;
  @ApiProperty({ type: String })
  endDate!: Date;
  @ApiPropertyOptional({ type: String, nullable: true })
  lastUpdated!: Date | null;
  @ApiProperty({ type: [ActivityMetadata] })
  activitiesMetadata!: ActivityMetadata[] | null;
}
