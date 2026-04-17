// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address } from 'viem';
import type { Page } from '@/domain/entities/page.entity';
import type { Token } from '@/modules/tokens/domain/entities/token.entity';

export const ITokenRepository = Symbol('ITokenRepository');

export interface ITokenRepository {
  getToken(args: { chainId: string; address: Address }): Promise<Token>;

  getTokens(args: {
    chainId: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<Token>>;
}
