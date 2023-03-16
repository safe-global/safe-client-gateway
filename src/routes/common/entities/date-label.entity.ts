import { ApiProperty } from '@nestjs/swagger';

export class DateLabel {
  @ApiProperty()
  type: string;
  @ApiProperty()
  timestamp: number;

  constructor(timestamp: number) {
    this.type = 'DATE_LABEL';
    this.timestamp = timestamp;
  }
}
