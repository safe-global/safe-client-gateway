import { ApiProperty } from '@nestjs/swagger';

export class CreateDataDecodedDto {
  @ApiProperty()
  data: string;
  @ApiProperty()
  to: string;
}
