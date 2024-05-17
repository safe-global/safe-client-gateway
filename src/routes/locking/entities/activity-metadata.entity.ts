import { ActivityMetadata as DomainActivityMetadata } from '@/domain/community/entities/activity-metadata.entity';
import { ApiProperty } from '@nestjs/swagger';

export class ActivityMetadata implements DomainActivityMetadata {
  @ApiProperty()
  campaignId!: string;
  @ApiProperty()
  name!: string;
  @ApiProperty()
  description!: string;
  @ApiProperty()
  maxPoints!: string;
}
