import { Balance as DomainBalance } from '../entities/balance.entity';
import { ApiProperty } from '@nestjs/swagger';
import { TokenInfo as ApiTokenInfo } from '../../../common/openapi/api-token-info';

export class Balance implements DomainBalance {
  @ApiProperty()
  balance: string;
  @ApiProperty()
  fiatBalance: number;
  @ApiProperty()
  fiatConversion: number;
  @ApiProperty()
  tokenInfo: ApiTokenInfo;
}
