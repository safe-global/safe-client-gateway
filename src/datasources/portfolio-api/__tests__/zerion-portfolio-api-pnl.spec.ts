import { PnLBuilder } from '@/domain/portfolio/entities/__tests__/pnl.builder';

describe('ZerionPortfolioApi - PnL', () => {
  describe('PnL Builder', () => {
    it('should build default PnL data', () => {
      const pnl = new PnLBuilder().build();

      expect(pnl!.realizedGain).toBe(1000);
      expect(pnl!.unrealizedGain).toBe(500);
      expect(pnl!.totalFee).toBe(25.5);
      expect(pnl!.netInvested).toBe(5000);
      expect(pnl!.receivedExternal).toBe(2000);
      expect(pnl!.sentExternal).toBe(1000);
      expect(pnl!.sentForNfts).toBe(100);
      expect(pnl!.receivedForNfts).toBe(50);
    });

    it('should build custom PnL data', () => {
      const pnl = new PnLBuilder()
        .withRealizedGain(5000)
        .withUnrealizedGain(2000)
        .build();

      expect(pnl!.realizedGain).toBe(5000);
      expect(pnl!.unrealizedGain).toBe(2000);
      expect(pnl!.totalFee).toBe(25.5);
    });

    it('should build PnL with zero values', () => {
      const pnl = new PnLBuilder()
        .withRealizedGain(0)
        .withUnrealizedGain(0)
        .withTotalFee(0)
        .withNetInvested(0)
        .withReceivedExternal(0)
        .withSentExternal(0)
        .withSentForNfts(0)
        .withReceivedForNfts(0)
        .build();

      expect(pnl!.realizedGain).toBe(0);
      expect(pnl!.unrealizedGain).toBe(0);
      expect(pnl!.totalFee).toBe(0);
    });

    it('should build PnL with negative values', () => {
      const pnl = new PnLBuilder()
        .withRealizedGain(-1000)
        .withUnrealizedGain(-500)
        .build();

      expect(pnl!.realizedGain).toBe(-1000);
      expect(pnl!.unrealizedGain).toBe(-500);
    });

    it('should build PnL with large decimal values', () => {
      const pnl = new PnLBuilder()
        .withRealizedGain(999999.99)
        .withUnrealizedGain(123456.789)
        .withTotalFee(0.001)
        .build();

      expect(pnl!.realizedGain).toBe(999999.99);
      expect(pnl!.unrealizedGain).toBe(123456.789);
      expect(pnl!.totalFee).toBe(0.001);
    });
  });
});
