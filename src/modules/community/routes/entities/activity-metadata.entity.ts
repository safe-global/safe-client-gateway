import { ApiProperty } from '@nestjs/swagger';
import type { ActivityMetadata as DomainActivityMetadata } from '@/modules/community/domain/entities/activity-metadata.entity';

export class ActivityMetadata implements DomainActivityMetadata {
  @ApiProperty()
  name!: string;
  @ApiProperty()
  description!: string;
  @ApiProperty()
  maxPoints!: number;
}
