import { ApiProperty } from '@nestjs/swagger';
import { TokenType } from './token-type.entity';

export class TokenInfo {
  @ApiProperty()
  address: string;
  @ApiProperty()
  decimals: number;
  @ApiProperty()
  logoUri: string;
  @ApiProperty()
  name: string;
  @ApiProperty()
  symbol: string;
  @ApiProperty({ enum: Object.values(TokenType) })
  tokenType: TokenType;
}
