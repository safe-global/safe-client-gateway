import { ApiExtraModels, ApiProperty } from '@nestjs/swagger';

class ProtocolIcon {
  @ApiProperty({ type: String, nullable: true })
  url!: string | null;
}

@ApiExtraModels(ProtocolIcon)
export class ProtocolMetadata {
  @ApiProperty()
  name!: string;
  @ApiProperty()
  icon!: ProtocolIcon;
}
