// SPDX-License-Identifier: FSL-1.1-MIT
import type { Page } from '@/domain/entities/page.entity';
import type { GasToken } from '@/modules/fees/domain/entities/gas-token.entity';

export const IGasTokensRepository = Symbol('IGasTokensRepository');

export interface IGasTokensRepository {
  getGasTokens(args: {
    chainId: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<GasToken>>;
}
