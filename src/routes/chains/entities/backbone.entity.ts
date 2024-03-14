import { Backbone as DomainBackbone } from '@/domain/backbone/entities/backbone.entity';
import { ApiProperty } from '@nestjs/swagger';

export class Backbone implements DomainBackbone {
  @ApiProperty()
  api_version!: string;
  @ApiProperty()
  headers!: string[] | null;
  @ApiProperty()
  host!: string;
  @ApiProperty()
  name!: string;
  @ApiProperty()
  secure!: boolean;
  @ApiProperty()
  settings!: Record<string, unknown> | null;
  @ApiProperty()
  version!: string;
}
