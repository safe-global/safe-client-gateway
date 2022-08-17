import { TokenInfo } from '../../common/entities/tokeninfo.entity';

export interface Balance {
  tokenInfo: TokenInfo;
  balance: string;
  fiatBalance: number;
  fiatConversion: number;
}
