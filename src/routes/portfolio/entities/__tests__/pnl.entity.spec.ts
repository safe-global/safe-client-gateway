import { PnL } from '@/routes/portfolio/entities/pnl.entity';
import { PnLBuilder } from '@/domain/portfolio/entities/__tests__/pnl.builder';

describe('PnL API Entity', () => {
  describe('constructor', () => {
    it('should create PnL entity from domain PnL', () => {
      const domainPnL = new PnLBuilder().build();
      if (!domainPnL) throw new Error('PnL should not be null');

      const pnl = new PnL(domainPnL);

      expect(pnl.realizedGain).toBe(1000);
      expect(pnl.unrealizedGain).toBe(500);
      expect(pnl.totalFee).toBe(25.5);
      expect(pnl.netInvested).toBe(5000);
      expect(pnl.receivedExternal).toBe(2000);
      expect(pnl.sentExternal).toBe(1000);
      expect(pnl.sentForNfts).toBe(100);
      expect(pnl.receivedForNfts).toBe(50);
    });

    it('should map custom domain PnL values', () => {
      const domainPnL = new PnLBuilder()
        .withRealizedGain(5000)
        .withUnrealizedGain(2000)
        .withTotalFee(100)
        .withNetInvested(10000)
        .withReceivedExternal(3000)
        .withSentExternal(2000)
        .withSentForNfts(500)
        .withReceivedForNfts(250)
        .build();
      if (!domainPnL) throw new Error('PnL should not be null');

      const pnl = new PnL(domainPnL);

      expect(pnl.realizedGain).toBe(5000);
      expect(pnl.unrealizedGain).toBe(2000);
      expect(pnl.totalFee).toBe(100);
      expect(pnl.netInvested).toBe(10000);
      expect(pnl.receivedExternal).toBe(3000);
      expect(pnl.sentExternal).toBe(2000);
      expect(pnl.sentForNfts).toBe(500);
      expect(pnl.receivedForNfts).toBe(250);
    });

    it('should handle zero values', () => {
      const domainPnL = new PnLBuilder()
        .withRealizedGain(0)
        .withUnrealizedGain(0)
        .withTotalFee(0)
        .withNetInvested(0)
        .withReceivedExternal(0)
        .withSentExternal(0)
        .withSentForNfts(0)
        .withReceivedForNfts(0)
        .build();
      if (!domainPnL) throw new Error('PnL should not be null');

      const pnl = new PnL(domainPnL);

      expect(pnl.realizedGain).toBe(0);
      expect(pnl.unrealizedGain).toBe(0);
      expect(pnl.totalFee).toBe(0);
      expect(pnl.netInvested).toBe(0);
      expect(pnl.receivedExternal).toBe(0);
      expect(pnl.sentExternal).toBe(0);
      expect(pnl.sentForNfts).toBe(0);
      expect(pnl.receivedForNfts).toBe(0);
    });

    it('should handle negative values', () => {
      const domainPnL = new PnLBuilder()
        .withRealizedGain(-1000)
        .withUnrealizedGain(-500)
        .withTotalFee(-25.5)
        .build();
      if (!domainPnL) throw new Error('PnL should not be null');

      const pnl = new PnL(domainPnL);

      expect(pnl.realizedGain).toBe(-1000);
      expect(pnl.unrealizedGain).toBe(-500);
      expect(pnl.totalFee).toBe(-25.5);
    });

    it('should handle decimal values', () => {
      const domainPnL = new PnLBuilder()
        .withRealizedGain(1000.123)
        .withUnrealizedGain(500.456)
        .withTotalFee(25.789)
        .withNetInvested(5000.111)
        .withReceivedExternal(2000.222)
        .withSentExternal(1000.333)
        .withSentForNfts(100.444)
        .withReceivedForNfts(50.555)
        .build();
      if (!domainPnL) throw new Error('PnL should not be null');

      const pnl = new PnL(domainPnL);

      expect(pnl.realizedGain).toBe(1000.123);
      expect(pnl.unrealizedGain).toBe(500.456);
      expect(pnl.totalFee).toBe(25.789);
      expect(pnl.netInvested).toBe(5000.111);
      expect(pnl.receivedExternal).toBe(2000.222);
      expect(pnl.sentExternal).toBe(1000.333);
      expect(pnl.sentForNfts).toBe(100.444);
      expect(pnl.receivedForNfts).toBe(50.555);
    });
  });

  describe('structure', () => {
    it('should have all required fields', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const domainPnL = new PnLBuilder().build() as any;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const pnl = new PnL(domainPnL);

      expect(Object.keys(pnl)).toEqual([
        'realizedGain',
        'unrealizedGain',
        'totalFee',
        'netInvested',
        'receivedExternal',
        'sentExternal',
        'sentForNfts',
        'receivedForNfts',
      ]);
    });

    it('should not have extra fields', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const domainPnL = new PnLBuilder().build() as any;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const pnl = new PnL(domainPnL);

      expect(Object.keys(pnl).length).toBe(8);
    });
  });
});
