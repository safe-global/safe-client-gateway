// SPDX-License-Identifier: FSL-1.1-MIT
import { CacheRouter } from '@/datasources/cache/cache.router';
import type { BaseDataDecoded } from '@/modules/data-decoder/domain/v2/entities/data-decoded.entity';
import { getAddress } from 'viem';
import { faker } from '@faker-js/faker';

const address = getAddress(faker.finance.ethereumAddress());

describe('CacheRouter', () => {
  describe('portfolio cache keys', () => {
    it('should use distinct keys for positions and wallet portfolio endpoints', () => {
      const portfolioDir = CacheRouter.getPortfolioCacheDir({
        address,
        fiatCode: 'USD',
      });
      const walletPortfolioDir = CacheRouter.getZerionWalletPortfolioCacheDir({
        address,
        fiatCode: 'USD',
      });

      expect(portfolioDir.key).toBe(`portfolio_${address}_zerion`);
      expect(walletPortfolioDir.key).toBe(`zerion_wallet_portfolio_${address}`);
      expect(portfolioDir.key).not.toBe(walletPortfolioDir.key);
    });

    it('should produce correct cache dir for positions endpoint', () => {
      const dir = CacheRouter.getPortfolioCacheDir({
        address,
        fiatCode: 'USD',
        trusted: true,
        isTestnet: false,
      });

      expect(dir.key).toBe(`portfolio_${address}_zerion`);
      expect(dir.field).toBe('usd_trusted');
    });

    it('should produce correct cache dir for wallet portfolio endpoint', () => {
      const dir = CacheRouter.getZerionWalletPortfolioCacheDir({
        address,
        fiatCode: 'EUR',
        trusted: false,
        isTestnet: true,
      });

      expect(dir.key).toBe(`zerion_wallet_portfolio_${address}`);
      expect(dir.field).toBe('eur_testnet');
    });

    it('should normalize fiatCode to lowercase for cache key consistency', () => {
      const dirLower = CacheRouter.getPortfolioCacheDir({
        address,
        fiatCode: 'usd',
      });
      const dirUpper = CacheRouter.getPortfolioCacheDir({
        address,
        fiatCode: 'USD',
      });

      expect(dirLower.key).toBe(dirUpper.key);
      expect(dirLower.field).toBe(dirUpper.field);
      expect(dirLower.field).toBe('usd');
    });
  });

  describe('deadlock analysis cache keys', () => {
    const chainId = '1';
    const safeAddress = getAddress(faker.finance.ethereumAddress());

    const addOwnerDecoded: BaseDataDecoded = {
      method: 'addOwnerWithThreshold',
      parameters: [
        { name: 'owner', type: 'address', value: address },
        { name: '_threshold', type: 'uint256', value: '1' },
      ],
    } as BaseDataDecoded;

    const changeThresholdDecoded: BaseDataDecoded = {
      method: 'changeThreshold',
      parameters: [{ name: '_threshold', type: 'uint256', value: '2' }],
    } as BaseDataDecoded;

    it('should accept an array with a single item', () => {
      const dir = CacheRouter.getDeadlockAnalysisCacheDir({
        chainId,
        safeAddress,
        dataDecoded: [addOwnerDecoded],
      });

      expect(dir.key).toBe(`${chainId}_deadlock_analysis_${safeAddress}`);
      expect(dir.field).toEqual(expect.any(String));
      expect(dir.field.length).toBe(64); // sha256 hex
    });

    it('should produce different hashes for different orderings', () => {
      const dir1 = CacheRouter.getDeadlockAnalysisCacheDir({
        chainId,
        safeAddress,
        dataDecoded: [addOwnerDecoded, changeThresholdDecoded],
      });
      const dir2 = CacheRouter.getDeadlockAnalysisCacheDir({
        chainId,
        safeAddress,
        dataDecoded: [changeThresholdDecoded, addOwnerDecoded],
      });

      expect(dir1.key).toBe(dir2.key);
      expect(dir1.field).not.toBe(dir2.field);
    });

    it('should produce different hashes for single vs multiple items', () => {
      const dirSingle = CacheRouter.getDeadlockAnalysisCacheDir({
        chainId,
        safeAddress,
        dataDecoded: [addOwnerDecoded],
      });
      const dirMulti = CacheRouter.getDeadlockAnalysisCacheDir({
        chainId,
        safeAddress,
        dataDecoded: [addOwnerDecoded, changeThresholdDecoded],
      });

      expect(dirSingle.field).not.toBe(dirMulti.field);
    });
  });
});
