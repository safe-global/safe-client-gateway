import { ApiProperty } from '@nestjs/swagger';

export abstract class Transfer {
  @ApiProperty()
  type: string;

  protected constructor(type: string) {
    this.type = type;
  }
}
