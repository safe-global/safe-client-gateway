import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class Delegate {
  @ApiPropertyOptional()
  safe: string | null;
  @ApiProperty()
  delegate: string;
  @ApiProperty()
  delegator: string;
  @ApiProperty()
  label: string;
}
