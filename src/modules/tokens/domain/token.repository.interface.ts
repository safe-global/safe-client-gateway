import type { Page } from '@/domain/entities/page.entity';
import type { Token } from '@/modules/tokens/domain/entities/token.entity';
import type { Address } from 'viem';

export const ITokenRepository = Symbol('ITokenRepository');

export interface ITokenRepository {
  getToken(args: { chainId: string; address: Address }): Promise<Token>;

  getTokens(args: {
    chainId: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<Token>>;
}
