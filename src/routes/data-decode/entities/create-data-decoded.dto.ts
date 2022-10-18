import { ApiProperty } from '@nestjs/swagger';

export class CreateDataDecodedDto {
  @ApiProperty()
  data: string;
  @ApiProperty()
  to: string;

  constructor(data: string, to: string) {
    this.data = data;
    this.to = to;
  }
}
