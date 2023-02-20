import { ApiProperty } from '@nestjs/swagger';

export class GetDataDecodedDto {
  @ApiProperty({ description: 'Hexadecimal value' })
  data: string;
  @ApiProperty({ description: 'Hexadecimal value' })
  to: string;

  constructor(data: string, to: string) {
    this.data = data;
    this.to = to;
  }
}
