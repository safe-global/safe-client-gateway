import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GetDataDecodedDto {
  @ApiProperty({ description: 'Hexadecimal value' })
  data: string;
  @ApiPropertyOptional({ description: 'The target Ethereum address' })
  to?: string;

  constructor(data: string, to: string) {
    this.data = data;
    this.to = to;
  }
}
