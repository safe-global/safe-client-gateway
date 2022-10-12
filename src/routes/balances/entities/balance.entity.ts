import { ApiProperty } from '@nestjs/swagger';
import { TokenInfo } from './token-info.entity';

export class Balance {
  @ApiProperty()
  balance: string;
  @ApiProperty()
  fiatBalance: number;
  @ApiProperty()
  fiatConversion: number;
  @ApiProperty()
  tokenInfo: TokenInfo;
}
