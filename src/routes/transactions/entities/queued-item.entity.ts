import { ApiProperty } from '@nestjs/swagger';

export class QueuedItem {
  @ApiProperty()
  type: string;

  constructor(type: string) {
    this.type = type;
  }
}
