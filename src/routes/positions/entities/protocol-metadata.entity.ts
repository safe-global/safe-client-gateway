import { ApiProperty } from '@nestjs/swagger';

class ProtocolIcon {
  @ApiProperty({ type: String, nullable: true })
  url!: string | null;
}

export class ProtocolMetadata {
  @ApiProperty()
  name!: string;
  @ApiProperty()
  icon!: ProtocolIcon;
}
