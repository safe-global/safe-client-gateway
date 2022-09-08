import { TokenInfo } from '../../../common/entities/token-info.entity';

export interface Balance {
  tokenInfo: TokenInfo;
  balance: string;
  fiatBalance: number;
  fiatConversion: number;
}
