import { PnLSchema } from '@/domain/portfolio/entities/pnl.entity';
import { PnLBuilder } from '@/domain/portfolio/entities/__tests__/pnl.builder';

describe('PnLSchema', () => {
  describe('valid PnL data', () => {
    it('should parse valid PnL data', () => {
      const pnl = new PnLBuilder().build();
      const result = PnLSchema.safeParse(pnl);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(pnl);
      }
    });

    it('should parse PnL with zero values', () => {
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

      const result = PnLSchema.safeParse(pnl);

      expect(result.success).toBe(true);
    });

    it('should parse PnL with negative values', () => {
      const pnl = new PnLBuilder()
        .withRealizedGain(-1000)
        .withUnrealizedGain(-500)
        .withTotalFee(-25.5)
        .build();

      const result = PnLSchema.safeParse(pnl);

      expect(result.success).toBe(true);
    });

    it('should parse PnL with large decimal values', () => {
      const pnl = new PnLBuilder()
        .withRealizedGain(9999999.99)
        .withUnrealizedGain(1234567.891)
        .build();

      const result = PnLSchema.safeParse(pnl);

      expect(result.success).toBe(true);
    });
  });

  describe('null PnL', () => {
    it('should parse null PnL', () => {
      const result = PnLSchema.safeParse(null);

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });
  });

  describe('invalid PnL data', () => {
    it('should reject missing realizedGain', () => {
      const pnl = new PnLBuilder().build();
      const { realizedGain, ...invalid } = pnl as unknown as Record<
        string,
        unknown
      >;
      void realizedGain;

      const result = PnLSchema.safeParse(invalid);

      expect(result.success).toBe(false);
    });

    it('should reject missing unrealizedGain', () => {
      const pnl = new PnLBuilder().build();
      const { unrealizedGain, ...invalid } = pnl as unknown as Record<
        string,
        unknown
      >;
      void unrealizedGain;

      const result = PnLSchema.safeParse(invalid);

      expect(result.success).toBe(false);
    });

    it('should reject missing totalFee', () => {
      const pnl = new PnLBuilder().build();
      const { totalFee, ...invalid } = pnl as unknown as Record<
        string,
        unknown
      >;
      void totalFee;

      const result = PnLSchema.safeParse(invalid);

      expect(result.success).toBe(false);
    });

    it('should reject missing netInvested', () => {
      const pnl = new PnLBuilder().build();
      const { netInvested, ...invalid } = pnl as unknown as Record<
        string,
        unknown
      >;
      void netInvested;

      const result = PnLSchema.safeParse(invalid);

      expect(result.success).toBe(false);
    });

    it('should reject missing receivedExternal', () => {
      const pnl = new PnLBuilder().build();
      const { receivedExternal, ...invalid } = pnl as unknown as Record<
        string,
        unknown
      >;
      void receivedExternal;

      const result = PnLSchema.safeParse(invalid);

      expect(result.success).toBe(false);
    });

    it('should reject missing sentExternal', () => {
      const pnl = new PnLBuilder().build();
      const { sentExternal, ...invalid } = pnl as unknown as Record<
        string,
        unknown
      >;
      void sentExternal;

      const result = PnLSchema.safeParse(invalid);

      expect(result.success).toBe(false);
    });

    it('should reject missing sentForNfts', () => {
      const pnl = new PnLBuilder().build();
      const { sentForNfts, ...invalid } = pnl as unknown as Record<
        string,
        unknown
      >;
      void sentForNfts;

      const result = PnLSchema.safeParse(invalid);

      expect(result.success).toBe(false);
    });

    it('should reject missing receivedForNfts', () => {
      const pnl = new PnLBuilder().build();
      const { receivedForNfts, ...invalid } = pnl as unknown as Record<
        string,
        unknown
      >;
      void receivedForNfts;

      const result = PnLSchema.safeParse(invalid);

      expect(result.success).toBe(false);
    });

    it('should reject non-number realizedGain', () => {
      const result = PnLSchema.safeParse({
        realizedGain: 'not-a-number',
        unrealizedGain: 500,
        totalFee: 25.5,
        netInvested: 5000,
        receivedExternal: 2000,
        sentExternal: 1000,
        sentForNfts: 100,
        receivedForNfts: 50,
      });

      expect(result.success).toBe(false);
    });

    it('should reject non-number unrealizedGain', () => {
      const result = PnLSchema.safeParse({
        realizedGain: 1000,
        unrealizedGain: true,
        totalFee: 25.5,
        netInvested: 5000,
        receivedExternal: 2000,
        sentExternal: 1000,
        sentForNfts: 100,
        receivedForNfts: 50,
      });

      expect(result.success).toBe(false);
    });

    it('should reject additional fields', () => {
      const pnl = new PnLBuilder().build();
      if (!pnl) throw new Error('PnL should not be null');

      const invalid = {
        ...pnl,
        extraField: 'should-not-exist',
      };

      const result = PnLSchema.safeParse(invalid);

      expect(result.success).toBe(false);
    });
  });
});
