import { CacheRouter } from '@/datasources/cache/cache.router';
import { getAddress } from 'viem';

const address = getAddress('0x1234567890123456789012345678901234567890');

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
});
