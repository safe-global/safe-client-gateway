import { ApiProperty } from '@nestjs/swagger';
import { Token } from './token.entity';

export class Balance {
  @ApiProperty()
  balance: string;
  @ApiProperty()
  fiatBalance: number;
  @ApiProperty()
  fiatConversion: number;
  @ApiProperty()
  tokenInfo: Token;
}
