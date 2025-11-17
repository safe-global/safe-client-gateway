import { ActivityMetadata as DomainActivityMetadata } from '@/modules/community/domain/entities/activity-metadata.entity';
import { ApiProperty } from '@nestjs/swagger';

export class ActivityMetadata implements DomainActivityMetadata {
  @ApiProperty()
  name!: string;
  @ApiProperty()
  description!: string;
  @ApiProperty()
  maxPoints!: number;
}
