import { faker } from '@faker-js/faker';
import {
  gasCostBuilder,
  bridgeQuoteBuilder,
} from '@/domain/bridge/entities/__tests__/bridge-quote.builder';
import {
  GasCostSchema,
  BridgeQuoteSchema,
} from '@/domain/bridge/entities/bridge-quote.entity';

describe('BridgeQuoteSchema', () => {
  describe('GasCostSchema', () => {
    it('should validate a GasCost', () => {
      const gasCost = gasCostBuilder().build();

      const result = GasCostSchema.safeParse(gasCost);

      expect(result.success).toBe(true);
    });

    it('type should default to UNKNOWN', () => {
      const gasCost = gasCostBuilder()
        .with('type', 'not a real status' as 'UNKNOWN')
        .build();

      const result = GasCostSchema.safeParse(gasCost);

      expect(result.success && result.data.type).toBe('UNKNOWN');
    });
  });

  describe('BridgeQuoteSchema', () => {
    it('should validate a BridgeQuote', () => {
      const bridgeQuote = bridgeQuoteBuilder().build();

      const result = BridgeQuoteSchema.safeParse(bridgeQuote);

      expect(result.success).toBe(true);
    });

    it('should only accept lifi type', () => {
      const type = faker.word.sample();
      const bridgeQuote = bridgeQuoteBuilder()
        .with('type', type as 'lifi')
        .build();

      const result = BridgeQuoteSchema.safeParse(bridgeQuote);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_literal',
          expected: 'lifi',
          message: 'Invalid literal value, expected "lifi"',
          path: ['type'],
          received: type,
        },
      ]);
    });
  });
});
