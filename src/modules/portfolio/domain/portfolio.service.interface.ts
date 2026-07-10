// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address } from 'viem';
import type { Portfolio } from '@/modules/portfolio/domain/entities/portfolio.entity';

export const IPortfolioService = Symbol('IPortfolioService');

export interface IPortfolioService {
  getPortfolio(args: {
    address: Address;
    fiatCode: string;
    chainIds?: Array<string>;
    trusted?: boolean;
    excludeDust?: boolean;
    isTestnet?: boolean;
    sync?: boolean;
  }): Promise<Portfolio>;

  clearZerionCaches(args: { address: Address }): Promise<void>;
}
