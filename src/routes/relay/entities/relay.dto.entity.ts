import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RelayDto {
  @ApiProperty()
  version!: string;

  @ApiProperty()
  to!: string;

  @ApiProperty()
  data!: string;

  @ApiPropertyOptional({ type: BigInt, nullable: true })
  gasLimit!: string | null;
}
