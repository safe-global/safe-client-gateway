import { ApiProperty } from '@nestjs/swagger';

export class GasPriceResponse {
  @ApiProperty()
  result!: unknown;

  @ApiProperty()
  gasParameter!: string;

  @ApiProperty()
  gweiFactor!: string;
}
