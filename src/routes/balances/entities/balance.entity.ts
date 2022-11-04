import { ApiProperty } from '@nestjs/swagger';
import { TokenInfo } from './token-info.entity';

export class Balance {
  @ApiProperty()
  balance: string;
  @ApiProperty()
  fiatBalance: string;
  @ApiProperty()
  fiatConversion: string;
  @ApiProperty()
  tokenInfo: TokenInfo;
}
