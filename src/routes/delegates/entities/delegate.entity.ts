import { ApiProperty } from '@nestjs/swagger';

export class Delegate {
  @ApiProperty()
  safe?: string;
  @ApiProperty()
  delegate: string;
  @ApiProperty()
  delegator: string;
  @ApiProperty()
  label: string;
}
